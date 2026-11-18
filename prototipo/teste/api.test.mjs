// Testes de contrato da API falsa (docs/prototipo/API.md). Cada grupo sobe o próprio servidor em porta livre.
// Rodar: node --test prototipo/teste/api.test.mjs
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { request } from 'node:http';
import { fileURLToPath } from 'node:url';

const SERVIDOR = fileURLToPath(new URL('../server.mjs', import.meta.url));
const lerWeb = (arquivo) => readFileSync(new URL(`../web/${arquivo}`, import.meta.url), 'utf8');
const processos = new Set();
process.on('exit', () => {
  for (const filho of processos) filho.kill();
});

/** Sobe uma loja com PORTA=0; devolve a base HTTP, a linha de partida e a função que encerra o processo. */
async function subirLoja(loja) {
  const filho = spawn(process.execPath, [SERVIDOR], {
    env: { ...process.env, LOJA: loja, PORTA: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  processos.add(filho);
  let erros = '';
  filho.stderr.setEncoding('utf8');
  filho.stderr.on('data', (d) => { erros += d; });
  const linha = await new Promise((resolver, rejeitar) => {
    let saida = '';
    filho.stdout.setEncoding('utf8');
    filho.stdout.on('data', (d) => {
      saida += d;
      const fim = saida.indexOf('\n');
      if (fim >= 0) resolver(saida.slice(0, fim));
    });
    filho.once('exit', (codigo) => rejeitar(new Error(`o servidor saiu (${codigo}): ${erros}`)));
  });
  const porta = Number(/http:\/\/localhost:(\d+)/.exec(linha)?.[1]);
  const encerrar = () => {
    filho.kill();
    processos.delete(filho);
  };
  return { base: `http://127.0.0.1:${porta}`, porta, linha, encerrar };
}

/** Pedido HTTP à loja; corpo objeto vira JSON, corpo string vai como está. */
async function pedir(base, metodo, caminho, corpo, token) {
  const cabecalhos = {};
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
  if (token) cabecalhos.Authorization = `Bearer ${token}`;
  const resposta = await fetch(base + caminho, {
    method: metodo,
    headers: cabecalhos,
    body: corpo === undefined || typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
  });
  const texto = await resposta.text();
  let dados = null;
  try {
    dados = JSON.parse(texto);
  } catch {}
  return { status: resposta.status, dados, texto };
}

/** Registra no grupo atual uma loja que sobe no before e encerra no after. */
function usarLoja(loja) {
  const s = {};
  let token;
  before(async () => {
    Object.assign(s, await subirLoja(loja));
  });
  after(() => s.encerrar?.());
  s.pedir = (metodo, caminho, corpo) => pedir(s.base, metodo, caminho, corpo);
  s.admin = async (metodo, caminho, corpo) => {
    token ??= (await pedir(s.base, 'POST', '/api/admin/login', { senha: 'admin' })).dados.token;
    return pedir(s.base, metodo, caminho, corpo, token);
  };
  return s;
}

describe('partida', () => {
  const loja = usarLoja('jogos');

  it('desvio D4: a linha de partida imprime a porta real', async () => {
    assert.notEqual(loja.porta, 0);
    assert.equal(
      loja.linha,
      `[jogos] Loja de Jogos: http://localhost:${loja.porta}  (admin: http://localhost:${loja.porta}/admin)`,
    );
    assert.equal((await loja.pedir('GET', '/api/loja')).status, 200);
  });
});

/** Confere o corpo de erro do contrato: { erro: <texto>, detalhes: <lista> }. */
function assertErro(resposta, status) {
  assert.equal(resposta.status, status, resposta.texto);
  assert.equal(typeof resposta.dados?.erro, 'string');
  assert.ok(Array.isArray(resposta.dados.detalhes));
}

describe('corpo grande', () => {
  const loja = usarLoja('jogos');

  it('desvio D1: corpo de 2 MB devolve 413 em todas as tentativas', async () => {
    const corpo = JSON.stringify({ observacao: 'x'.repeat(2_000_000) });
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const r = await loja.pedir('POST', '/api/pedidos', corpo);
      assertErro(r, 413);
      assert.deepEqual(r.dados, { erro: 'Corpo grande demais.', detalhes: [] });
    }
  });
});

const CLIENTE = { nome: 'Ana Souza', telefone: '(11) 98765-4321' };
const PRODUTO = { nome: 'Produto X', categoriaId: 'c2', precoCentavos: 1000, atributos: {} };

describe('atributos com nome de Object.prototype', () => {
  const loja = usarLoja('jogos');

  it('desvio D2: atributo com nome de Object.prototype lê só o valor do produto', async () => {
    for (const nome of ['toString', 'valueOf', 'constructor']) {
      const categoria = await loja.admin('POST', '/api/admin/categorias', { nome: `Cat ${nome}`, atributos: [nome] });
      assert.equal(categoria.status, 201);
      const valores = async () => {
        const r = await loja.pedir('GET', '/api/categorias');
        assert.equal(r.status, 200);
        return r.dados.find((c) => c.id === categoria.dados.id).atributos[0].valores;
      };
      assert.deepEqual(await valores(), []);
      const comValor = { ...PRODUTO, categoriaId: categoria.dados.id, atributos: { [nome]: 'x' } };
      assert.equal((await loja.admin('POST', '/api/admin/produtos', comValor)).status, 201);
      assert.equal((await loja.admin('POST', '/api/admin/produtos', { ...PRODUTO, categoriaId: categoria.dados.id })).status, 201);
      assert.deepEqual(await valores(), ['x']);
      const filtro = await loja.pedir('GET', `/api/produtos?categoria=${categoria.dados.id}&a.${nome}=x`);
      assert.equal(filtro.dados.total, 1);
    }
  });
});

describe('ids novos', () => {
  const loja = usarLoja('jogos');

  it('desvio D6: id de produto ou categoria excluído não é reusado', async () => {
    assert.equal((await loja.admin('DELETE', '/api/admin/produtos/p12')).status, 204);
    const p13 = await loja.admin('POST', '/api/admin/produtos', PRODUTO);
    assert.equal(p13.dados.id, 'p13');
    assert.equal((await loja.admin('DELETE', '/api/admin/produtos/p13')).status, 204);
    assert.equal((await loja.admin('POST', '/api/admin/produtos', PRODUTO)).dados.id, 'p14');
    const c4 = await loja.admin('POST', '/api/admin/categorias', { nome: 'Vazia', atributos: [] });
    assert.equal(c4.dados.id, 'c4');
    assert.equal((await loja.admin('DELETE', '/api/admin/categorias/c4')).status, 204);
    assert.equal((await loja.admin('POST', '/api/admin/categorias', { nome: 'Outra', atributos: [] })).dados.id, 'c5');
  });
});

describe('total da mensagem', () => {
  const loja = usarLoja('impressao3d');

  it('desvio D3: só itens sob consulta decidem o total "sob consulta"', async () => {
    const brinde = await loja.admin('POST', '/api/admin/produtos', { nome: 'Brinde', categoriaId: 'c3', precoCentavos: 0 });
    assert.equal(brinde.status, 201);
    const ultimaLinha = async (itens) => {
      const r = await loja.pedir('POST', '/api/pedidos', { cliente: CLIENTE, itens });
      assert.equal(r.status, 201, r.texto);
      return r.dados.mensagem.split('\n').at(-1);
    };
    const sobConsulta = { produtoId: 'p3', quantidade: 1 };
    const precoZero = { produtoId: brinde.dados.id, quantidade: 1 };
    assert.equal(await ultimaLinha([sobConsulta, precoZero]), '*Total: R$ 0,00* + itens sob consulta');
    assert.equal(await ultimaLinha([precoZero]), '*Total: R$ 0,00*');
    assert.equal(await ultimaLinha([sobConsulta]), '*Total: sob consulta*');
  });
});

describe('tamanho do valor de atributo', () => {
  const loja = usarLoja('jogos');

  it('atributo 81: valor acima de 80 caracteres devolve 422 e nada é gravado', async () => {
    const quantos = async () => (await loja.admin('GET', '/api/admin/produtos')).dados.length;
    const antes = await quantos();
    const longo = await loja.admin('POST', '/api/admin/produtos', { ...PRODUTO, atributos: { Plataforma: 'y'.repeat(81) } });
    assert.deepEqual(longo.dados, { erro: 'Dados inválidos.', detalhes: ['Plataforma: até 80 caracteres.'] });
    assert.equal(longo.status, 422);
    const dois = await loja.admin('POST', '/api/admin/produtos', {
      ...PRODUTO,
      atributos: { Plataforma: 'y'.repeat(81), Condição: 'z'.repeat(90), Inexistente: 'w'.repeat(200) },
    });
    assert.deepEqual(dois.dados.detalhes, ['Plataforma: até 80 caracteres.', 'Condição: até 80 caracteres.']);
    assert.equal(await quantos(), antes);

    const exato = await loja.admin('POST', '/api/admin/produtos', {
      ...PRODUTO,
      atributos: { Plataforma: `  ${'y'.repeat(80)}  `, Condição: '', Inexistente: 'w' },
    });
    assert.equal(exato.status, 201);
    assert.deepEqual(exato.dados.atributos, { Plataforma: 'y'.repeat(80) });

    const put = await loja.admin('PUT', `/api/admin/produtos/${exato.dados.id}`, { ...PRODUTO, atributos: { Plataforma: 'y'.repeat(81) } });
    assert.equal(put.status, 422);
    assert.deepEqual(put.dados.detalhes, ['Plataforma: até 80 caracteres.']);
    const gravado = (await loja.admin('GET', '/api/admin/produtos')).dados.find((p) => p.id === exato.dados.id);
    assert.deepEqual(gravado.atributos, { Plataforma: 'y'.repeat(80) });
  });
});

const CAMPOS_PUBLICOS = [
  'id', 'nome', 'descricao', 'categoriaId', 'precoCentavos', 'precoPromocionalCentavos',
  'sobConsulta', 'disponivel', 'destaque', 'imagemUrl', 'atributos',
];
const ids = (resposta) => resposta.dados.itens.map((p) => p.id);

describe('catálogo público', () => {
  const loja = usarLoja('jogos');

  it('caso 01: GET /api/loja devolve só id, nome e slogan', async () => {
    const r = await loja.pedir('GET', '/api/loja');
    assert.equal(r.status, 200);
    assert.deepEqual(r.dados, { id: 'jogos', nome: 'Loja de Jogos', slogan: 'Jogos, consoles e acessórios, novos e usados' });
  });

  it('caso 02: GET /api/categorias conta os produtos e lista os valores em ordem', async () => {
    const r = await loja.pedir('GET', '/api/categorias');
    assert.equal(r.status, 200);
    assert.deepEqual(r.dados.map((c) => [c.id, c.nome, c.total]), [['c1', 'Jogos', 7], ['c2', 'Consoles', 2], ['c3', 'Acessórios', 3]]);
    const plataforma = r.dados[0].atributos.find((a) => a.nome === 'Plataforma');
    assert.deepEqual(plataforma.valores, ['PS4', 'PS5', 'Switch', 'Xbox Series']);
  });

  it('caso 03: GET /api/produtos pagina sobre o total filtrado', async () => {
    const todos = await loja.pedir('GET', '/api/produtos');
    assert.equal(todos.dados.total, 12);
    assert.equal(todos.dados.itens.length, 12);
    const segunda = await loja.pedir('GET', '/api/produtos?porPagina=8&pagina=2');
    assert.deepEqual(ids(segunda), ['p9', 'p10', 'p11', 'p12']);
    assert.equal(segunda.dados.total, 12);
    assert.equal(segunda.dados.pagina, 2);
    assert.equal(segunda.dados.porPagina, 8);
  });

  it('caso 04: filtros de categoria, atributo, destaque, busca e ids', async () => {
    assert.equal((await loja.pedir('GET', '/api/produtos?categoria=c2')).dados.total, 2);
    assert.deepEqual(ids(await loja.pedir('GET', '/api/produtos?categoria=c1&a.Plataforma=PS5')), ['p1', 'p3']);
    assert.deepEqual(ids(await loja.pedir('GET', '/api/produtos?destaque=1')), ['p1', 'p2', 'p8', 'p11']);
    const busca = await loja.pedir('GET', '/api/produtos?busca=ragnarok');
    assert.deepEqual(busca.dados.itens.map((p) => p.nome), ['God of War Ragnarök']);
    assert.deepEqual(ids(await loja.pedir('GET', '/api/produtos?ids=p1,p10')), ['p1', 'p10']);
  });

  it('caso 05: a visão pública não expõe estoque, origem, idExterno nem ativo', async () => {
    const r = await loja.pedir('GET', '/api/produtos');
    for (const p of r.dados.itens) assert.deepEqual(Object.keys(p), CAMPOS_PUBLICOS, p.id);
    assert.equal(r.dados.itens.find((p) => p.id === 'p5').disponivel, false);
    const p5 = await loja.pedir('GET', '/api/produtos/p5');
    assert.deepEqual(Object.keys(p5.dados), CAMPOS_PUBLICOS);
    assert.equal(p5.dados.disponivel, false);
  });

  it('caso 06: produto inexistente ou desativado devolve 404 e some da lista', async () => {
    const inexistente = await loja.pedir('GET', '/api/produtos/p999');
    assertErro(inexistente, 404);
    const p2 = (await loja.admin('GET', '/api/admin/produtos')).dados.find((p) => p.id === 'p2');
    assert.equal((await loja.admin('PUT', '/api/admin/produtos/p2', { ...p2, ativo: false })).status, 200);
    assertErro(await loja.pedir('GET', '/api/produtos/p2'), 404);
    const lista = await loja.pedir('GET', '/api/produtos');
    assert.equal(lista.dados.total, 11);
    assert.ok(!ids(lista).includes('p2'));
  });
});

const MENSAGEM_ANA = (numero) => [
  `*Pedido #${numero} - Loja de Jogos*`,
  'Cliente: Ana Souza',
  'Telefone: 11987654321',
  '',
  '2x EA Sports FC 26 - R$ 499,80',
  '1x Controle DualSense - R$ 449,90',
  '',
  '*Total: R$ 949,70*',
].join('\n');
const ITENS_ANA = [{ produtoId: 'p1', quantidade: 2 }, { produtoId: 'p10', quantidade: 1 }];

describe('numeração do pedido', () => {
  const loja = usarLoja('jogos');

  it('caso 09: o primeiro pedido do processo é 1001 e o seguinte 1002', async () => {
    const primeiro = await loja.pedir('POST', '/api/pedidos', { cliente: CLIENTE, itens: ITENS_ANA });
    assert.equal(primeiro.dados.numero, 1001);
    const segundo = await loja.pedir('POST', '/api/pedidos', { cliente: CLIENTE, itens: ITENS_ANA });
    assert.equal(segundo.dados.numero, 1002);
  });
});

describe('pedido', () => {
  const loja = usarLoja('jogos');
  const quantosPedidos = async () => (await loja.admin('GET', '/api/admin/pedidos')).dados.length;

  it('caso 07: pedido com preço do servidor, mensagem e link do WhatsApp', async () => {
    const r = await loja.pedir('POST', '/api/pedidos', { cliente: CLIENTE, itens: ITENS_ANA });
    assert.equal(r.status, 201);
    assert.deepEqual(Object.keys(r.dados), ['numero', 'totalCentavos', 'temSobConsulta', 'mensagem', 'linkWhatsApp']);
    assert.equal(r.dados.totalCentavos, 94970);
    assert.equal(r.dados.temSobConsulta, false);
    assert.equal(r.dados.mensagem, MENSAGEM_ANA(r.dados.numero));
    const prefixo = 'https://wa.me/5500000000000?text=';
    assert.ok(r.dados.linkWhatsApp.startsWith(prefixo), r.dados.linkWhatsApp);
    assert.equal(decodeURIComponent(r.dados.linkWhatsApp.slice(prefixo.length)), r.dados.mensagem);
  });

  it('caso 08: com observação, a mensagem termina com o bloco Obs.', async () => {
    const r = await loja.pedir('POST', '/api/pedidos', { cliente: CLIENTE, itens: ITENS_ANA, observacao: '  Retiro na loja no sábado.  ' });
    assert.equal(r.dados.mensagem, `${MENSAGEM_ANA(r.dados.numero)}\n\nObs.: Retiro na loja no sábado.`);
  });

  it('caso 10: preço enviado pelo navegador é ignorado', async () => {
    const r = await loja.pedir('POST', '/api/pedidos', {
      cliente: CLIENTE,
      itens: [{ produtoId: 'p10', quantidade: 1, precoCentavos: 1 }],
    });
    assert.equal(r.status, 201);
    assert.equal(r.dados.totalCentavos, 44990);
  });

  it('caso 11: o mesmo produto repetido vira um item com a soma das quantidades', async () => {
    const r = await loja.pedir('POST', '/api/pedidos', {
      cliente: CLIENTE,
      itens: [{ produtoId: 'p10', quantidade: 1 }, { produtoId: 'p10', quantidade: 2 }],
    });
    assert.equal(r.dados.totalCentavos, 134970);
    const gravado = (await loja.admin('GET', '/api/admin/pedidos')).dados.find((p) => p.numero === r.dados.numero);
    assert.deepEqual(gravado.itens, [
      { produtoId: 'p10', nome: 'Controle DualSense', quantidade: 3, precoUnitarioCentavos: 44990, subtotalCentavos: 134970 },
    ]);
  });

  it('caso 12: pedido inválido devolve 422 e não é gravado', async () => {
    const antes = await quantosPedidos();
    const casos = [
      [{ cliente: { ...CLIENTE, nome: 'A' }, itens: ITENS_ANA }, 'Nome: de 2 a 80 caracteres.'],
      [{ cliente: { ...CLIENTE, telefone: '119876543' }, itens: ITENS_ANA }, 'Telefone: informe DDD e número.'],
      [{ cliente: CLIENTE, itens: [] }, 'Carrinho: de 1 a 50 itens.'],
      [{ cliente: CLIENTE, itens: [{ produtoId: 'p1', quantidade: 0 }] }, 'Carrinho: item inválido.'],
      [{ cliente: CLIENTE, itens: [{ produtoId: 'p1', quantidade: 100 }] }, 'Carrinho: item inválido.'],
      [{ cliente: CLIENTE, itens: [{ produtoId: 'p1', quantidade: 1.5 }] }, 'Carrinho: item inválido.'],
      [{ cliente: CLIENTE, itens: [{ produtoId: 'p999', quantidade: 1 }] }, 'Um produto do carrinho não está mais à venda.'],
      [{ cliente: CLIENTE, itens: [{ produtoId: 'p5', quantidade: 1 }] }, 'Elden Ring: indisponível.'],
      [{ cliente: CLIENTE, itens: [{ produtoId: 'p3', quantidade: 3 }] }, 'God of War Ragnarök: só há 2 em estoque.'],
      [{ cliente: CLIENTE, itens: ITENS_ANA, observacao: 'o'.repeat(501) }, 'Observação: até 500 caracteres.'],
    ];
    for (const [corpo, detalhe] of casos) {
      const r = await loja.pedir('POST', '/api/pedidos', corpo);
      assert.deepEqual(r.dados, { erro: 'Não foi possível fechar o pedido.', detalhes: [detalhe] });
      assert.equal(r.status, 422);
    }
    assert.equal(await quantosPedidos(), antes);
  });
});

describe('pedido com item sob consulta', () => {
  const loja = usarLoja('impressao3d');

  it('caso 13: item sob consulta entra sem valor e o total avisa', async () => {
    const misto = await loja.pedir('POST', '/api/pedidos', {
      cliente: CLIENTE,
      itens: [{ produtoId: 'p3', quantidade: 1 }, { produtoId: 'p7', quantidade: 1 }],
    });
    assert.equal(misto.status, 201);
    assert.equal(misto.dados.totalCentavos, 11990);
    assert.equal(misto.dados.temSobConsulta, true);
    const linhas = misto.dados.mensagem.split('\n');
    assert.ok(linhas.includes('1x Bambu Lab X1 Carbon - sob consulta'), misto.dados.mensagem);
    assert.equal(linhas.at(-1), '*Total: R$ 119,90* + itens sob consulta');
    const so = await loja.pedir('POST', '/api/pedidos', { cliente: CLIENTE, itens: [{ produtoId: 'p3', quantidade: 1 }] });
    assert.equal(so.dados.mensagem.split('\n').at(-1), '*Total: sob consulta*');
    assert.equal(so.dados.totalCentavos, 0);
    assert.equal(so.dados.temSobConsulta, true);
  });
});

describe('admin', () => {
  const loja = usarLoja('jogos');
  const quantosProdutos = async () => (await loja.admin('GET', '/api/admin/produtos')).dados.length;

  it('caso 14: rota de admin exige token de login com a senha certa', async () => {
    const semToken = await pedir(loja.base, 'GET', '/api/admin/produtos');
    assertErro(semToken, 401);
    assertErro(await pedir(loja.base, 'GET', '/api/admin/produtos', undefined, 'token-falso'), 401);
    const errada = await pedir(loja.base, 'POST', '/api/admin/login', { senha: 'errada' });
    assertErro(errada, 401);
    const login = await pedir(loja.base, 'POST', '/api/admin/login', { senha: 'admin' });
    assert.equal(login.status, 200);
    assert.equal(typeof login.dados.token, 'string');
    const comToken = await pedir(loja.base, 'GET', '/api/admin/produtos', undefined, login.dados.token);
    assert.equal(comToken.status, 200);
    assert.equal(comToken.dados.length, 12);
  });

  it('caso 15: criar, atualizar e excluir produto', async () => {
    const corpo = { nome: 'Jogo Novo', categoriaId: 'c1', precoCentavos: 5000, atributos: { Plataforma: 'PS5', Cor: 'Azul' } };
    const criado = await loja.admin('POST', '/api/admin/produtos', corpo);
    assert.equal(criado.status, 201);
    assert.equal(criado.dados.id, 'p13');
    assert.equal(criado.dados.origem, 'manual');
    assert.equal(criado.dados.idExterno, null);
    assert.equal(criado.dados.sincronizadoEm, null);
    assert.deepEqual(criado.dados.atributos, { Plataforma: 'PS5' });
    assert.deepEqual(ids(await loja.pedir('GET', '/api/produtos?ids=p13')), ['p13']);

    const atualizado = await loja.admin('PUT', '/api/admin/produtos/p13', { ...corpo, nome: 'Jogo Atualizado', precoCentavos: 6000, estoque: 3 });
    assert.equal(atualizado.status, 200);
    const publico = await loja.pedir('GET', '/api/produtos/p13');
    assert.equal(publico.dados.nome, 'Jogo Atualizado');
    assert.equal(publico.dados.precoCentavos, 6000);
    assert.equal((await loja.admin('GET', '/api/admin/produtos')).dados.find((p) => p.id === 'p13').estoque, 3);

    const excluido = await loja.admin('DELETE', '/api/admin/produtos/p13');
    assert.equal(excluido.status, 204);
    assert.equal(excluido.texto, '');
    assertErro(await loja.admin('DELETE', '/api/admin/produtos/p13'), 404);
  });

  it('caso 16: produto inválido devolve 422 e não é gravado', async () => {
    const antes = await quantosProdutos();
    const base = { nome: 'Produto Y', categoriaId: 'c1', precoCentavos: 1000 };
    const casos = [
      [{ nome: 'Produto Y', categoriaId: 'c1' }, 'Preço: informe um valor ou marque "sob consulta".'],
      [{ ...base, precoPromocionalCentavos: 1000 }, 'Preço promocional: deve ser menor que o preço.'],
      [{ ...base, precoPromocionalCentavos: 2000 }, 'Preço promocional: deve ser menor que o preço.'],
      [{ ...base, estoque: -1 }, 'Estoque: número inteiro, ou vazio para não controlar.'],
      [{ ...base, imagemUrl: 'javascript:alert(1)' }, 'Imagem: URL http(s) de até 500 caracteres.'],
      [{ ...base, categoriaId: 'c99' }, 'Categoria: escolha uma categoria existente.'],
    ];
    for (const [corpo, detalhe] of casos) {
      const r = await loja.admin('POST', '/api/admin/produtos', corpo);
      assert.deepEqual(r.dados, { erro: 'Dados inválidos.', detalhes: [detalhe] });
      assert.equal(r.status, 422);
    }
    assert.equal(await quantosProdutos(), antes);
  });

  it('caso 17: sob consulta grava os dois preços nulos', async () => {
    const r = await loja.admin('POST', '/api/admin/produtos', {
      nome: 'Edição de colecionador', categoriaId: 'c1', sobConsulta: true, precoCentavos: 50000, precoPromocionalCentavos: 40000,
    });
    assert.equal(r.status, 201);
    assert.equal(r.dados.sobConsulta, true);
    assert.equal(r.dados.precoCentavos, null);
    assert.equal(r.dados.precoPromocionalCentavos, null);
  });

  it('caso 18: criar, atualizar e excluir categoria', async () => {
    const criada = await loja.admin('POST', '/api/admin/categorias', { nome: 'Colecionáveis', atributos: ['Material', 'Escala'] });
    assert.equal(criada.status, 201);
    assert.deepEqual(criada.dados, { id: 'c4', nome: 'Colecionáveis', atributos: ['Material', 'Escala'] });
    const produto = await loja.admin('POST', '/api/admin/produtos', {
      nome: 'Estátua', categoriaId: 'c4', precoCentavos: 9000, atributos: { Material: 'Resina', Escala: '1:6' },
    });
    assert.deepEqual(produto.dados.atributos, { Material: 'Resina', Escala: '1:6' });

    const atualizada = await loja.admin('PUT', '/api/admin/categorias/c4', { nome: 'Colecionáveis', atributos: ['Material'] });
    assert.deepEqual(atualizada.dados, { id: 'c4', nome: 'Colecionáveis', atributos: ['Material'] });
    const gravado = (await loja.admin('GET', '/api/admin/produtos')).dados.find((p) => p.id === produto.dados.id);
    assert.deepEqual(gravado.atributos, { Material: 'Resina' });

    assertErro(await loja.admin('DELETE', '/api/admin/categorias/c4'), 409);
    const vazia = await loja.admin('POST', '/api/admin/categorias', { nome: 'Vazia', atributos: [] });
    assert.equal((await loja.admin('DELETE', `/api/admin/categorias/${vazia.dados.id}`)).status, 204);
    const invalida = await loja.admin('POST', '/api/admin/categorias', { nome: 'Inválida', atributos: ['a<b'] });
    assert.deepEqual(invalida.dados, { erro: 'Dados inválidos.', detalhes: ['Atributos: só letras, números e espaços, até 40 caracteres cada.'] });
    assert.equal(invalida.status, 422);
  });
});

describe('pedidos e loja no admin', () => {
  const loja = usarLoja('jogos');
  const numeros = async (consulta = '') => (await loja.admin('GET', `/api/admin/pedidos${consulta}`)).dados.map((p) => p.numero);

  it('caso 19: lista de pedidos, filtro e mudança de status', async () => {
    for (let i = 0; i < 3; i++) await loja.pedir('POST', '/api/pedidos', { cliente: CLIENTE, itens: ITENS_ANA });
    assert.deepEqual(await numeros(), [1003, 1002, 1001]);
    const alterado = await loja.admin('PATCH', '/api/admin/pedidos/1002', { status: 'em_atendimento' });
    assert.equal(alterado.status, 200);
    assert.equal(alterado.dados.status, 'em_atendimento');
    assert.deepEqual(await numeros('?status=novo'), [1003, 1001]);
    assert.deepEqual(await numeros('?status=em_atendimento'), [1002]);
    const invalido = await loja.admin('PATCH', '/api/admin/pedidos/1001', { status: 'pago' });
    assert.deepEqual(invalido.dados, { erro: 'Status inválido.', detalhes: ['Use: novo, em_atendimento, concluido, cancelado.'] });
    assert.equal(invalido.status, 422);
    assertErro(await loja.admin('PATCH', '/api/admin/pedidos/9999', { status: 'concluido' }), 404);
  });

  it('caso 20: o WhatsApp novo da loja vale para o pedido seguinte', async () => {
    const corpoLoja = { nome: 'Loja de Jogos', slogan: 'Jogos, consoles e acessórios, novos e usados' };
    const atualizada = await loja.admin('PUT', '/api/admin/loja', { ...corpoLoja, whatsapp: '+55 11 90000-0000' });
    assert.equal(atualizada.status, 200);
    assert.equal(atualizada.dados.whatsapp, '5511900000000');
    const pedido = await loja.pedir('POST', '/api/pedidos', { cliente: CLIENTE, itens: ITENS_ANA });
    assert.ok(pedido.dados.linkWhatsApp.startsWith('https://wa.me/5511900000000?text='), pedido.dados.linkWhatsApp);
    const curto = await loja.admin('PUT', '/api/admin/loja', { ...corpoLoja, whatsapp: '12345' });
    assert.deepEqual(curto.dados, { erro: 'Dados inválidos.', detalhes: ['WhatsApp: número com DDI e DDD, só dígitos.'] });
    assert.equal(curto.status, 422);
  });
});

/** Pedido com node:http cru: o caminho vai como está, sem a normalização do fetch. */
const pedirCru = (porta, caminho) => new Promise((resolver, rejeitar) => {
  const req = request({ host: '127.0.0.1', port: porta, path: caminho }, (res) => {
    res.resume();
    res.on('end', () => resolver(res.statusCode));
  });
  req.on('error', rejeitar);
  req.end();
});

/** Corpo JSON com exatamente `bytes` bytes. */
const corpoDeTamanho = (bytes) => {
  const moldura = JSON.stringify({ observacao: '' });
  return JSON.stringify({ observacao: 'x'.repeat(bytes - moldura.length) });
};

describe('HTTP', () => {
  const loja = usarLoja('jogos');

  it('caso 21: corpo malformado, rota inexistente, método errado e corpo grande', async () => {
    assertErro(await loja.pedir('POST', '/api/pedidos', '{"cliente":'), 400);
    assertErro(await loja.pedir('POST', '/api/pedidos', '[]'), 400);
    assertErro(await loja.pedir('GET', '/api/nada'), 404);
    assertErro(await loja.pedir('DELETE', '/api/produtos'), 405);
    const corpo = corpoDeTamanho(100_001);
    assert.equal(Buffer.byteLength(corpo), 100_001);
    assertErro(await loja.pedir('POST', '/api/pedidos', corpo), 413);
  });

  it('caso 22: todo erro tem corpo com erro e detalhes', async () => {
    const respostas = {
      400: await loja.pedir('POST', '/api/pedidos', '{'),
      401: await loja.pedir('GET', '/api/admin/pedidos'),
      404: await loja.pedir('GET', '/api/produtos/p999'),
      405: await loja.pedir('PUT', '/api/loja', {}),
      409: await loja.admin('DELETE', '/api/admin/categorias/c1'),
      413: await loja.pedir('POST', '/api/pedidos', corpoDeTamanho(100_001)),
      422: await loja.pedir('POST', '/api/pedidos', {}),
    };
    for (const [status, resposta] of Object.entries(respostas)) {
      assertErro(resposta, Number(status));
      assert.deepEqual(Object.keys(resposta.dados), ['erro', 'detalhes']);
    }
  });

  it('caso 24: caminho com .. não sai da pasta web', async () => {
    for (const caminho of ['/../server.mjs', '/%2e%2e/server.mjs', '/..%2fserver.mjs']) {
      assert.equal(await pedirCru(loja.porta, caminho), 404, caminho);
    }
  });
});

describe('duas lojas', () => {
  const jogos = usarLoja('jogos');
  const impressao = usarLoja('impressao3d');

  it('caso 23: arquivos estáticos, com tema por loja e base comum', async () => {
    const indice = await jogos.pedir('GET', '/');
    assert.equal(indice.status, 200);
    assert.equal(indice.texto, lerWeb('index.html'));
    assert.equal((await jogos.pedir('GET', '/admin')).texto, lerWeb('admin.html'));
    const tema = await jogos.pedir('GET', '/tema.css');
    assert.equal(tema.status, 200);
    assert.notEqual(tema.texto, (await impressao.pedir('GET', '/tema.css')).texto);
    const base = await jogos.pedir('GET', '/base.css');
    assert.equal(base.texto, lerWeb('base.css'));
    assert.equal((await impressao.pedir('GET', '/base.css')).texto, base.texto);
  });

  it('caso 25: pedido de uma loja não aparece na outra', async () => {
    const pedido = await jogos.pedir('POST', '/api/pedidos', { cliente: CLIENTE, itens: ITENS_ANA });
    assert.equal(pedido.status, 201);
    assert.deepEqual((await jogos.admin('GET', '/api/admin/pedidos')).dados.map((p) => p.numero), [pedido.dados.numero]);
    assert.deepEqual((await impressao.admin('GET', '/api/admin/pedidos')).dados, []);
  });
});

describe('tolerâncias', () => {
  const loja = usarLoja('jogos');

  it('tolerância T1: atributo repetido na categoria é unido', async () => {
    const r = await loja.admin('POST', '/api/admin/categorias', { nome: 'Cores', atributos: ['Cor', 'Cor'] });
    assert.equal(r.status, 201);
    assert.deepEqual(r.dados.atributos, ['Cor']);
  });

  it('tolerância T2: ids vazio devolve todos os produtos', async () => {
    const r = await loja.pedir('GET', '/api/produtos?ids=');
    assert.equal(r.dados.total, 12);
  });

  it('tolerância T3: porPagina e pagina fora da faixa são ajustados', async () => {
    assert.equal((await loja.pedir('GET', '/api/produtos?porPagina=0')).dados.porPagina, 12);
    assert.equal((await loja.pedir('GET', '/api/produtos?porPagina=99')).dados.porPagina, 50);
    assert.equal((await loja.pedir('GET', '/api/produtos?pagina=0')).dados.pagina, 1);
  });

  it('tolerância T4: preço 1e21 é aceito', async () => {
    const r = await loja.admin('POST', '/api/admin/produtos', { nome: 'Preço enorme', categoriaId: 'c1', precoCentavos: 1e21 });
    assert.equal(r.status, 201);
    assert.equal(r.dados.precoCentavos, 1e21);
  });

  it('tolerância T5: status desconhecido no filtro devolve lista vazia', async () => {
    await loja.pedir('POST', '/api/pedidos', { cliente: CLIENTE, itens: ITENS_ANA });
    const r = await loja.admin('GET', '/api/admin/pedidos?status=xyz');
    assert.equal(r.status, 200);
    assert.deepEqual(r.dados, []);
  });
});
