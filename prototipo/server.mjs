// Protótipo descartável: API falsa em memória + arquivos estáticos, sem dependências.
// Uma loja por processo (LOJA=<pasta em lojas/>), como será no deploy real.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const RAIZ = dirname(fileURLToPath(import.meta.url));
const LOJA = process.env.LOJA ?? 'jogos';
const PORTA = Number(process.env.PORTA ?? 4101);
const HOST = process.env.HOST ?? '127.0.0.1';
const SENHA_ADMIN = process.env.SENHA_ADMIN ?? 'admin';
const PASTA_LOJA = resolve(RAIZ, 'lojas', LOJA);

if (!/^[a-z0-9-]+$/.test(LOJA) || !existsSync(resolve(PASTA_LOJA, 'loja.json'))) {
  console.error(`Loja desconhecida: "${LOJA}". Use o nome de uma pasta de prototipo/lojas/.`);
  process.exit(1);
}

const lerJson = (arquivo) => JSON.parse(readFileSync(resolve(PASTA_LOJA, arquivo), 'utf8'));

// ---------- Estado em memória (some ao reiniciar) ----------

const loja = { id: LOJA, ...lerJson('loja.json') };
const { categorias, produtos } = lerJson('dados.json');
const pedidos = [];
const tokens = new Set();
let ultimoNumeroPedido = 1000;

for (const p of produtos) {
  Object.assign(p, {
    descricao: '', precoCentavos: null, precoPromocionalCentavos: null, sobConsulta: false,
    estoque: null, ativo: true, destaque: false, imagemUrl: '', atributos: {},
    origem: 'manual', idExterno: null, sincronizadoEm: null,
    ...p,
  });
}

// Último número usado por prefixo de id; só cresce, para um id excluído nunca voltar a outro item.
const maiorNumero = (lista) => Math.max(0, ...lista.map((x) => Number(x.id.slice(1)) || 0));
const ultimoId = { p: maiorNumero(produtos), c: maiorNumero(categorias) };

const STATUS = ['novo', 'em_atendimento', 'concluido', 'cancelado'];

class ErroHttp extends Error {
  constructor(status, mensagem, detalhes = []) {
    super(mensagem);
    this.status = status;
    this.detalhes = detalhes;
  }
}

// ---------- Regras ----------

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const inteiro = (v) => Number.isInteger(v) && v >= 0;
const semAcento = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const formatoMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const reais = (centavos) => formatoMoeda.format(centavos / 100).replace(/ /g, ' ');

const disponivel = (p) => p.estoque === null || p.estoque > 0;
const precoEfetivo = (p) => (p.sobConsulta ? null : p.precoPromocionalCentavos ?? p.precoCentavos);

const novoId = (prefixo) => `${prefixo}${++ultimoId[prefixo]}`;

// Só propriedade própria: um atributo chamado "toString" não pode ler o de Object.prototype.
const proprio = (objeto, chave) => (objeto != null && Object.hasOwn(objeto, chave) ? objeto[chave] : undefined);

function achar(lista, id, nome) {
  const item = lista.find((x) => x.id === id);
  if (!item) throw new ErroHttp(404, `${nome} não encontrado.`);
  return item;
}

// O que a vitrine pode ver: sem estoque exato, origem ou produtos inativos.
const visaoPublica = (p) => ({
  id: p.id,
  nome: p.nome,
  descricao: p.descricao,
  categoriaId: p.categoriaId,
  precoCentavos: p.sobConsulta ? null : p.precoCentavos,
  precoPromocionalCentavos: p.sobConsulta ? null : p.precoPromocionalCentavos,
  sobConsulta: p.sobConsulta,
  disponivel: disponivel(p),
  destaque: p.destaque,
  imagemUrl: p.imagemUrl,
  atributos: p.atributos,
});

function categoriasPublicas() {
  const ativos = produtos.filter((p) => p.ativo);
  return categorias.map((c) => {
    const daCategoria = ativos.filter((p) => p.categoriaId === c.id);
    return {
      id: c.id,
      nome: c.nome,
      total: daCategoria.length,
      atributos: c.atributos.map((nome) => ({
        nome,
        valores: [...new Set(daCategoria.map((p) => proprio(p.atributos, nome)).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b, 'pt-BR')),
      })),
    };
  });
}

function listarProdutos(query) {
  let lista = produtos.filter((p) => p.ativo);
  const ids = query.get('ids');
  if (ids) {
    const pedidosIds = new Set(ids.split(','));
    lista = lista.filter((p) => pedidosIds.has(p.id));
  }
  const categoria = query.get('categoria');
  if (categoria) lista = lista.filter((p) => p.categoriaId === categoria);
  if (query.get('destaque') === '1') lista = lista.filter((p) => p.destaque);
  const busca = semAcento(query.get('busca') ?? '').trim();
  if (busca) lista = lista.filter((p) => semAcento(`${p.nome} ${p.descricao}`).includes(busca));
  for (const [chave, valor] of query) {
    if (chave.startsWith('a.') && valor) lista = lista.filter((p) => proprio(p.atributos, chave.slice(2)) === valor);
  }
  const porPagina = Math.min(50, Math.max(1, parseInt(query.get('porPagina'), 10) || 12));
  const pagina = Math.max(1, parseInt(query.get('pagina'), 10) || 1);
  return {
    itens: lista.slice((pagina - 1) * porPagina, pagina * porPagina).map(visaoPublica),
    total: lista.length,
    pagina,
    porPagina,
  };
}

function validarProduto(e) {
  const erros = [];
  const nome = str(e.nome);
  if (nome.length < 2 || nome.length > 120) erros.push('Nome: de 2 a 120 caracteres.');
  const descricao = str(e.descricao);
  if (descricao.length > 2000) erros.push('Descrição: até 2000 caracteres.');
  const categoria = categorias.find((c) => c.id === e.categoriaId);
  if (!categoria) erros.push('Categoria: escolha uma categoria existente.');

  const sobConsulta = e.sobConsulta === true;
  let precoCentavos = null;
  let precoPromocionalCentavos = null;
  if (!sobConsulta) {
    if (inteiro(e.precoCentavos)) precoCentavos = e.precoCentavos;
    else erros.push('Preço: informe um valor ou marque "sob consulta".');
    if (e.precoPromocionalCentavos != null) {
      const promo = e.precoPromocionalCentavos;
      if (inteiro(promo) && (precoCentavos === null || promo < precoCentavos)) precoPromocionalCentavos = promo;
      else erros.push('Preço promocional: deve ser menor que o preço.');
    }
  }

  let estoque = null;
  if (e.estoque != null) {
    if (inteiro(e.estoque)) estoque = e.estoque;
    else erros.push('Estoque: número inteiro, ou vazio para não controlar.');
  }

  const imagemUrl = str(e.imagemUrl);
  if (imagemUrl && (imagemUrl.length > 500 || !/^https?:\/\//i.test(imagemUrl))) {
    erros.push('Imagem: URL http(s) de até 500 caracteres.');
  }

  // Só entram os atributos que a categoria define.
  const atributos = {};
  for (const nomeAtributo of categoria?.atributos ?? []) {
    const valor = str(proprio(e.atributos, nomeAtributo)).slice(0, 80);
    if (valor) atributos[nomeAtributo] = valor;
  }

  if (erros.length) throw new ErroHttp(422, 'Dados inválidos.', erros);
  return {
    nome, descricao, categoriaId: categoria.id, precoCentavos, precoPromocionalCentavos, sobConsulta,
    estoque, ativo: e.ativo !== false, destaque: e.destaque === true, imagemUrl, atributos,
  };
}

function validarCategoria(e) {
  const erros = [];
  const nome = str(e.nome);
  if (nome.length < 2 || nome.length > 60) erros.push('Nome: de 2 a 60 caracteres.');
  const atributos = [...new Set((Array.isArray(e.atributos) ? e.atributos : []).map(str).filter(Boolean))];
  if (atributos.length > 12) erros.push('Atributos: até 12 por categoria.');
  if (atributos.some((a) => !/^[\p{L}\p{N} ]{1,40}$/u.test(a))) {
    erros.push('Atributos: só letras, números e espaços, até 40 caracteres cada.');
  }
  if (erros.length) throw new ErroHttp(422, 'Dados inválidos.', erros);
  return { nome, atributos };
}

function validarLoja(e) {
  const erros = [];
  const nome = str(e.nome);
  if (nome.length < 2 || nome.length > 60) erros.push('Nome: de 2 a 60 caracteres.');
  const slogan = str(e.slogan);
  if (slogan.length > 120) erros.push('Slogan: até 120 caracteres.');
  const whatsapp = String(e.whatsapp ?? '').replace(/\D/g, '');
  if (whatsapp.length < 10 || whatsapp.length > 15) erros.push('WhatsApp: número com DDI e DDD, só dígitos.');
  if (erros.length) throw new ErroHttp(422, 'Dados inválidos.', erros);
  return { nome, slogan, whatsapp };
}

function montarMensagem(pedido) {
  const linhas = [
    `*Pedido #${pedido.numero} - ${loja.nome}*`,
    `Cliente: ${pedido.cliente.nome}`,
    `Telefone: ${pedido.cliente.telefone}`,
    '',
  ];
  for (const item of pedido.itens) {
    const valor = item.subtotalCentavos === null ? 'sob consulta' : reais(item.subtotalCentavos);
    linhas.push(`${item.quantidade}x ${item.nome} - ${valor}`);
  }
  const soConsulta = pedido.itens.every((item) => item.subtotalCentavos === null);
  const total = soConsulta ? 'sob consulta' : reais(pedido.totalCentavos);
  const complemento = pedido.temSobConsulta && !soConsulta ? ' + itens sob consulta' : '';
  linhas.push('', `*Total: ${total}*${complemento}`);
  if (pedido.observacao) linhas.push('', `Obs.: ${pedido.observacao}`);
  return linhas.join('\n');
}

// Preço e disponibilidade saem sempre do catálogo do servidor; o navegador só manda id e quantidade.
function criarPedido(e) {
  const erros = [];
  const nome = str(e.cliente?.nome);
  if (nome.length < 2 || nome.length > 80) erros.push('Nome: de 2 a 80 caracteres.');
  const telefone = String(e.cliente?.telefone ?? '').replace(/\D/g, '');
  if (telefone.length < 10 || telefone.length > 11) erros.push('Telefone: informe DDD e número.');
  const observacao = str(e.observacao);
  if (observacao.length > 500) erros.push('Observação: até 500 caracteres.');

  const recebidos = Array.isArray(e.itens) ? e.itens : [];
  if (recebidos.length < 1 || recebidos.length > 50) erros.push('Carrinho: de 1 a 50 itens.');
  const quantidades = new Map();
  for (const item of recebidos.slice(0, 50)) {
    const quantidade = item?.quantidade;
    if (typeof item?.produtoId !== 'string' || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 99) {
      erros.push('Carrinho: item inválido.');
      continue;
    }
    quantidades.set(item.produtoId, (quantidades.get(item.produtoId) ?? 0) + quantidade);
  }

  const itens = [];
  for (const [produtoId, quantidade] of quantidades) {
    const p = produtos.find((x) => x.id === produtoId && x.ativo);
    if (!p) erros.push('Um produto do carrinho não está mais à venda.');
    else if (!disponivel(p)) erros.push(`${p.nome}: indisponível.`);
    else if (quantidade > 99) erros.push(`${p.nome}: até 99 unidades por pedido.`);
    else if (p.estoque !== null && quantidade > p.estoque) erros.push(`${p.nome}: só há ${p.estoque} em estoque.`);
    else {
      const precoUnitarioCentavos = precoEfetivo(p);
      itens.push({
        produtoId,
        nome: p.nome,
        quantidade,
        precoUnitarioCentavos,
        subtotalCentavos: precoUnitarioCentavos === null ? null : precoUnitarioCentavos * quantidade,
      });
    }
  }
  if (erros.length) throw new ErroHttp(422, 'Não foi possível fechar o pedido.', [...new Set(erros)]);

  const pedido = {
    numero: ++ultimoNumeroPedido,
    criadoEm: new Date().toISOString(),
    status: 'novo',
    cliente: { nome, telefone },
    observacao,
    itens,
    totalCentavos: itens.reduce((soma, i) => soma + (i.subtotalCentavos ?? 0), 0),
    temSobConsulta: itens.some((i) => i.precoUnitarioCentavos === null),
  };
  pedido.mensagem = montarMensagem(pedido);
  pedido.linkWhatsApp = `https://wa.me/${loja.whatsapp}?text=${encodeURIComponent(pedido.mensagem)}`;
  pedidos.unshift(pedido);

  // A resposta pública não devolve os dados do cliente.
  const { numero, totalCentavos, temSobConsulta, mensagem, linkWhatsApp } = pedido;
  return { numero, totalCentavos, temSobConsulta, mensagem, linkWhatsApp };
}

// ---------- Rotas ----------

const rotas = [];
function rota(metodo, caminho, fn, { admin = false } = {}) {
  const re = new RegExp(`^${caminho.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`);
  rotas.push({ metodo, re, fn, admin });
}
const ADMIN = { admin: true };

rota('GET', '/api/loja', () => ({ id: loja.id, nome: loja.nome, slogan: loja.slogan }));
rota('GET', '/api/categorias', () => categoriasPublicas());
rota('GET', '/api/produtos', ({ query }) => listarProdutos(query));
rota('GET', '/api/produtos/:id', ({ params }) => {
  const p = produtos.find((x) => x.id === params.id && x.ativo);
  if (!p) throw new ErroHttp(404, 'Produto não encontrado.');
  return visaoPublica(p);
});
rota('POST', '/api/pedidos', (ctx) => {
  ctx.status = 201;
  return criarPedido(ctx.corpo);
});

rota('POST', '/api/admin/login', ({ corpo }) => {
  if (corpo.senha !== SENHA_ADMIN) throw new ErroHttp(401, 'Senha incorreta.');
  const token = randomBytes(24).toString('hex');
  tokens.add(token);
  return { token };
});

rota('GET', '/api/admin/produtos', () => produtos, ADMIN);
rota('POST', '/api/admin/produtos', (ctx) => {
  const produto = {
    id: novoId('p'), ...validarProduto(ctx.corpo),
    origem: 'manual', idExterno: null, sincronizadoEm: null,
  };
  produtos.push(produto);
  ctx.status = 201;
  return produto;
}, ADMIN);
rota('PUT', '/api/admin/produtos/:id', ({ params, corpo }) => (
  Object.assign(achar(produtos, params.id, 'Produto'), validarProduto(corpo))
), ADMIN);
rota('DELETE', '/api/admin/produtos/:id', ({ params }) => {
  produtos.splice(produtos.indexOf(achar(produtos, params.id, 'Produto')), 1);
}, ADMIN);

rota('GET', '/api/admin/categorias', () => categorias, ADMIN);
rota('POST', '/api/admin/categorias', (ctx) => {
  const categoria = { id: novoId('c'), ...validarCategoria(ctx.corpo) };
  categorias.push(categoria);
  ctx.status = 201;
  return categoria;
}, ADMIN);
rota('PUT', '/api/admin/categorias/:id', ({ params, corpo }) => {
  const categoria = Object.assign(achar(categorias, params.id, 'Categoria'), validarCategoria(corpo));
  // Atributo retirado da categoria sai também dos produtos dela.
  for (const p of produtos.filter((x) => x.categoriaId === categoria.id)) {
    p.atributos = Object.fromEntries(Object.entries(p.atributos).filter(([nome]) => categoria.atributos.includes(nome)));
  }
  return categoria;
}, ADMIN);
rota('DELETE', '/api/admin/categorias/:id', ({ params }) => {
  const categoria = achar(categorias, params.id, 'Categoria');
  if (produtos.some((p) => p.categoriaId === categoria.id)) {
    throw new ErroHttp(409, 'A categoria ainda tem produtos. Mova ou exclua os produtos antes.');
  }
  categorias.splice(categorias.indexOf(categoria), 1);
}, ADMIN);

rota('GET', '/api/admin/pedidos', ({ query }) => {
  const status = query.get('status');
  return status ? pedidos.filter((p) => p.status === status) : pedidos;
}, ADMIN);
rota('PATCH', '/api/admin/pedidos/:numero', ({ params, corpo }) => {
  const pedido = pedidos.find((p) => String(p.numero) === params.numero);
  if (!pedido) throw new ErroHttp(404, 'Pedido não encontrado.');
  if (!STATUS.includes(corpo.status)) throw new ErroHttp(422, 'Status inválido.', [`Use: ${STATUS.join(', ')}.`]);
  pedido.status = corpo.status;
  return pedido;
}, ADMIN);

rota('GET', '/api/admin/loja', () => loja, ADMIN);
rota('PUT', '/api/admin/loja', ({ corpo }) => Object.assign(loja, validarLoja(corpo)), ADMIN);

// ---------- HTTP ----------

function responder(res, status, corpo) {
  const cabecalhos = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (corpo === undefined) {
    res.writeHead(status, cabecalhos);
    res.end();
    return;
  }
  res.writeHead(status, { ...cabecalhos, 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(corpo));
}

async function lerCorpo(req) {
  const partes = [];
  let tamanho = 0;
  // Lê o corpo até o fim antes de recusar: lançar no meio da leitura derruba a conexão antes da resposta.
  for await (const parte of req) {
    tamanho += parte.length;
    if (tamanho <= 100_000) partes.push(parte);
  }
  if (tamanho > 100_000) throw new ErroHttp(413, 'Corpo grande demais.');
  if (!tamanho) return {};
  let dados;
  try {
    dados = JSON.parse(Buffer.concat(partes).toString('utf8'));
  } catch {
    throw new ErroHttp(400, 'JSON inválido.');
  }
  if (dados === null || typeof dados !== 'object' || Array.isArray(dados)) {
    throw new ErroHttp(400, 'O corpo deve ser um objeto JSON.');
  }
  return dados;
}

async function atenderApi(req, res, url) {
  const doCaminho = rotas.filter((r) => r.re.test(url.pathname));
  if (!doCaminho.length) throw new ErroHttp(404, 'Rota não encontrada.');
  const r = doCaminho.find((c) => c.metodo === req.method);
  if (!r) throw new ErroHttp(405, 'Método não permitido.');
  if (r.admin) {
    const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    if (!tokens.has(token)) throw new ErroHttp(401, 'Faça login.');
  }
  const params = {};
  for (const [nome, valor] of Object.entries(r.re.exec(url.pathname).groups ?? {})) {
    try {
      params[nome] = decodeURIComponent(valor);
    } catch {
      throw new ErroHttp(400, 'Caminho inválido.');
    }
  }
  const temCorpo = ['POST', 'PUT', 'PATCH'].includes(req.method);
  const ctx = { status: 200, params, query: url.searchParams, corpo: temCorpo ? await lerCorpo(req) : {} };
  const corpo = r.fn(ctx);
  responder(res, corpo === undefined ? 204 : ctx.status, corpo);
}

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

// Customização por pasta: lojas/<loja>/web/<arquivo> vence web/<arquivo>.
const PASTAS_WEB = [resolve(PASTA_LOJA, 'web'), resolve(RAIZ, 'web')];

async function atenderEstatico(req, res, pathname) {
  let caminho;
  try {
    caminho = decodeURIComponent(pathname);
  } catch {
    throw new ErroHttp(400, 'Caminho inválido.');
  }
  if (caminho === '/') caminho = '/index.html';
  if (caminho === '/admin') caminho = '/admin.html';

  for (const base of PASTAS_WEB) {
    const alvo = resolve(base, `.${caminho}`);
    if (!alvo.startsWith(base + sep)) continue;
    let conteudo;
    try {
      conteudo = await readFile(alvo);
    } catch {
      continue;
    }
    res.writeHead(200, {
      'Content-Type': TIPOS[extname(alvo)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : conteudo);
    return;
  }
  throw new ErroHttp(404, 'Arquivo não encontrado.');
}

const servidor = createServer(async (req, res) => {
  try {
    let url;
    try {
      url = new URL(req.url, 'http://local');
    } catch {
      throw new ErroHttp(400, 'URL inválida.');
    }
    if (url.pathname.startsWith('/api/')) await atenderApi(req, res, url);
    else if (req.method === 'GET' || req.method === 'HEAD') await atenderEstatico(req, res, url.pathname);
    else throw new ErroHttp(405, 'Método não permitido.');
  } catch (e) {
    if (res.headersSent) {
      res.end();
    } else if (e instanceof ErroHttp) {
      responder(res, e.status, { erro: e.message, detalhes: e.detalhes });
    } else {
      console.error(e);
      responder(res, 500, { erro: 'Erro interno.', detalhes: [] });
    }
  }
});

servidor.listen(PORTA, HOST, () => {
  const { port } = servidor.address();
  console.log(`[${LOJA}] ${loja.nome}: http://localhost:${port}  (admin: http://localhost:${port}/admin)`);
});
