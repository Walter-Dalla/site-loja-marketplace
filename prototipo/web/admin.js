// Telas do admin: login e as rotas de docs/prototipo/TELAS.md § Admin, desenhadas em #app.
import { esc, moeda, api, ErroApi, linhasDoErro, avisoHtml } from './comum.js';

const app = document.getElementById('app');
const nav = document.getElementById('nav');
const lojaNome = document.getElementById('loja-nome');

const CHAVE_TOKEN = 'adminToken';
const ROTA_INICIAL = '#/produtos';

// ---------- Sessão ----------

const lerToken = () => sessionStorage.getItem(CHAVE_TOKEN);

/** Lançado por `chamar` depois de um 401: a sessão já foi encerrada e o login já está na tela. */
class SessaoEncerrada extends Error {}

let lojaCarregada = false;

/** Toda chamada de admin passa por aqui: leva o token e trata o 401 (servidor reiniciado esquece os tokens). */
async function chamar(caminho, opcoes = {}) {
  try {
    return await api(caminho, { ...opcoes, token: lerToken() });
  } catch (erro) {
    if (erro instanceof ErroApi && erro.status === 401) {
      encerrarSessao();
      throw new SessaoEncerrada('Sessão encerrada.');
    }
    throw erro;
  }
}

function encerrarSessao() {
  sessionStorage.removeItem(CHAVE_TOKEN);
  avisoPendente = '';
  desenhar();
}

function mostrarNomeDaLoja(nome) {
  lojaNome.textContent = nome;
  document.title = nome ? `Admin · ${nome}` : 'Admin';
}

function carregarLoja() {
  if (lojaCarregada) return;
  lojaCarregada = true;
  chamar('/admin/loja')
    .then((loja) => mostrarNomeDaLoja(loja.nome))
    .catch(() => { lojaCarregada = false; });
}

// ---------- Avisos ----------

// Aviso de confirmação que atravessa uma troca de rota: lido e apagado pelo desenho seguinte.
let avisoPendente = '';

/** Mostra o erro de uma chamada; depois de um 401 não há o que mostrar (o login já está na tela). */
function mostrarErro(alvo, erro) {
  if (erro instanceof SessaoEncerrada) return;
  alvo.innerHTML = avisoHtml('erro', linhasDoErro(erro));
}

// ---------- Rotas ----------

let sequencia = 0;

/** Abre um novo desenho; a função devolvida diz se ele ainda é o mais recente. */
function novoDesenho() {
  const minha = ++sequencia;
  return () => minha === sequencia;
}

function lerRota() {
  const partes = location.hash.startsWith('#/') ? location.hash.slice(2).split('/') : [];
  if (partes.length === 1 && partes[0] !== 'produto' && Object.hasOwn(TELAS, partes[0])) {
    return { tela: partes[0], menu: partes[0] };
  }
  if (partes.length === 2 && partes[0] === 'produto' && partes[1] && Object.hasOwn(TELAS, 'produto')) {
    try {
      return { tela: 'produto', menu: 'produtos', id: decodeURIComponent(partes[1]) };
    } catch {
      return null;
    }
  }
  return null;
}

function marcarMenu(menu) {
  for (const a of nav.querySelectorAll('a[data-rota]')) {
    const atual = a.dataset.rota === menu;
    a.classList.toggle('atual', atual);
    if (atual) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

/** Desenha a rota do hash em #app. `manter`: sem o "Carregando…" (redesenho da mesma tela). */
async function desenhar({ manter = false } = {}) {
  const atual = novoDesenho();
  const aviso = avisoPendente;
  avisoPendente = '';

  if (!lerToken()) {
    nav.hidden = true;
    marcarMenu(null);
    lojaCarregada = false;
    mostrarNomeDaLoja('');
    telaLogin();
    return;
  }

  let rota = lerRota();
  if (!rota) {
    history.replaceState(null, '', ROTA_INICIAL);
    rota = lerRota();
  }
  nav.hidden = false;
  marcarMenu(rota.menu);
  carregarLoja();
  if (!manter) app.innerHTML = '<p class="suave">Carregando…</p>';
  try {
    await TELAS[rota.tela]({ atual, aviso, id: rota.id });
  } catch (erro) {
    if (!atual()) return;
    mostrarErro(app, erro);
  }
}

// ---------- Login ----------

function telaLogin() {
  app.innerHTML = `
    <section class="bloco entrada">
      <h1>Entrar no admin</h1>
      <form class="login formulario" novalidate>
        <label>Senha
          <input type="password" name="senha" autocomplete="current-password">
        </label>
        <div data-aviso></div>
        <div class="acoes"><button type="submit" class="botao">Entrar</button></div>
      </form>
    </section>`;
  const form = app.querySelector('form.login');
  const regiao = form.querySelector('[data-aviso]');
  const botao = form.querySelector('button[type="submit"]');
  form.senha.focus();
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    botao.disabled = true;
    try {
      // Chamada direta: aqui o 401 é "senha incorreta", não sessão vencida.
      const { token } = await api('/admin/login', { metodo: 'POST', corpo: { senha: form.senha.value } });
      sessionStorage.setItem(CHAVE_TOKEN, token);
      desenhar();
    } catch (erro) {
      botao.disabled = false;
      mostrarErro(regiao, erro);
    }
  });
}

// ---------- Produtos ----------

function precoNaLista(p) {
  if (p.sobConsulta) return 'Sob consulta';
  if (p.precoCentavos == null) return '—';
  if (p.precoPromocionalCentavos != null) {
    return `<s>${esc(moeda(p.precoCentavos))}</s> ${esc(moeda(p.precoPromocionalCentavos))}`;
  }
  return esc(moeda(p.precoCentavos));
}

const simNao = (valor) => (valor ? 'Sim' : 'Não');

async function telaProdutos({ atual, aviso }) {
  const [produtos, categorias] = await Promise.all([chamar('/admin/produtos'), chamar('/admin/categorias')]);
  if (!atual()) return;
  const nomeCategoria = new Map(categorias.map((c) => [c.id, c.nome]));
  const linhas = produtos.map((p) => `
    <tr data-produto="${esc(p.id)}">
      <td><a href="#/produto/${esc(encodeURIComponent(p.id))}">${esc(p.nome)}</a></td>
      <td>${esc(nomeCategoria.get(p.categoriaId) ?? p.categoriaId)}</td>
      <td class="numero">${precoNaLista(p)}</td>
      <td class="numero">${p.estoque == null ? '—' : esc(p.estoque)}</td>
      <td>${simNao(p.ativo)}</td>
      <td>${simNao(p.destaque)}</td>
      <td>${esc(p.origem)}</td>
    </tr>`).join('');
  app.innerHTML = `
    <div class="cabecalho">
      <h1>Produtos</h1>
      <a class="botao" href="#/produto/novo">Novo produto</a>
    </div>
    <div data-aviso>${aviso}</div>
    <div class="rolagem">
      <table class="produtos">
        <thead>
          <tr><th>Nome</th><th>Categoria</th><th class="numero">Preço</th><th class="numero">Estoque</th><th>Ativo</th><th>Destaque</th><th>Origem</th></tr>
        </thead>
        <tbody>${linhas || '<tr><td colspan="7" class="suave">Nenhum produto cadastrado.</td></tr>'}</tbody>
      </table>
    </div>`;
}

// ---------- Produto ----------

// Reais em pt-BR: 199,90 · 1.299,00 · 1299 (milhar com ponto opcional; centavos opcionais, 1 ou 2 casas).
const FORMATO_REAIS = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;

/** Texto em reais → centavos, por texto (sem ponto flutuante). Vazio: null. Inválido: undefined. */
function centavosDoTexto(texto) {
  const limpo = texto.trim();
  if (!limpo) return null;
  const partes = FORMATO_REAIS.exec(limpo);
  if (!partes) return undefined;
  const centavos = Number(partes[1].replaceAll('.', '') + (partes[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(centavos) ? centavos : undefined;
}

/** Centavos → texto em reais para o campo (29990 → 299,90; 129900 → 1.299,00). */
function textoDosCentavos(centavos) {
  if (centavos == null) return '';
  const digitos = String(centavos).padStart(3, '0');
  const reais = digitos.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${reais},${digitos.slice(-2)}`;
}

function camposDeAtributo(categoria, valores) {
  const nomes = categoria?.atributos ?? [];
  if (!nomes.length) return '<p class="dica">Esta categoria não tem atributos.</p>';
  return `<div class="duas">${nomes.map((nome) => `
    <label>${esc(nome)}
      <input type="text" data-atributo="${esc(nome)}" value="${esc(valores[nome] ?? '')}">
    </label>`).join('')}</div>`;
}

async function telaProduto({ atual, id }) {
  const novo = id === 'novo';
  const [categorias, produtos] = await Promise.all([
    chamar('/admin/categorias'),
    novo ? Promise.resolve([]) : chamar('/admin/produtos'),
  ]);
  if (!atual()) return;
  const produto = novo
    ? { nome: '', descricao: '', categoriaId: '', sobConsulta: false, precoCentavos: null, precoPromocionalCentavos: null, estoque: null, ativo: true, destaque: false, imagemUrl: '', atributos: {} }
    : produtos.find((p) => p.id === id);
  if (!produto) {
    app.innerHTML = `
      <div class="cabecalho"><h1>Produto não encontrado</h1></div>
      <p>Esse produto não existe ou foi excluído.</p>
      <p><a href="#/produtos">Voltar à lista de produtos</a></p>`;
    return;
  }

  const categoriaDe = (categoriaId) => categorias.find((c) => c.id === categoriaId);
  const temCategoria = !!categoriaDe(produto.categoriaId);
  const opcoes = (temCategoria ? '' : '<option value="">Escolha a categoria</option>')
    + categorias.map((c) => `<option value="${esc(c.id)}"${c.id === produto.categoriaId ? ' selected' : ''}>${esc(c.nome)}</option>`).join('');

  app.innerHTML = `
    <div class="cabecalho">
      <h1>${novo ? 'Novo produto' : 'Editar produto'}</h1>
      <a class="botao secundario" href="#/produtos">Voltar à lista</a>
    </div>
    <form class="produto formulario" novalidate>
      <label>Nome
        <input type="text" name="nome" value="${esc(produto.nome)}">
      </label>
      <label>Categoria
        <select name="categoriaId">${opcoes}</select>
      </label>
      <fieldset>
        <legend>Atributos</legend>
        <div data-atributos>${camposDeAtributo(categoriaDe(produto.categoriaId), produto.atributos)}</div>
      </fieldset>
      <label>Descrição
        <textarea name="descricao">${esc(produto.descricao)}</textarea>
      </label>
      <label class="caixa"><input type="checkbox" name="sobConsulta"${produto.sobConsulta ? ' checked' : ''}> Sob consulta (sem preço)</label>
      <div class="duas">
        <label>Preço (R$)
          <input type="text" inputmode="decimal" name="preco" autocomplete="off" value="${esc(textoDosCentavos(produto.precoCentavos))}">
          <span class="dica">Ex.: 199,90 ou 1.299,00</span>
        </label>
        <label>Preço promocional (R$)
          <input type="text" inputmode="decimal" name="precoPromocional" autocomplete="off" value="${esc(textoDosCentavos(produto.precoPromocionalCentavos))}">
          <span class="dica">Vazio: sem promoção</span>
        </label>
      </div>
      <label>Estoque
        <input type="text" inputmode="numeric" name="estoque" autocomplete="off" value="${produto.estoque == null ? '' : esc(produto.estoque)}">
        <span class="dica">Vazio: estoque não controlado</span>
      </label>
      <label>URL da imagem
        <input type="url" name="imagemUrl" value="${esc(produto.imagemUrl)}">
        <span class="dica">Endereço http(s) da imagem; vazio: capa com as iniciais</span>
      </label>
      <label class="caixa"><input type="checkbox" name="ativo"${produto.ativo ? ' checked' : ''}> Ativo (aparece na loja)</label>
      <label class="caixa"><input type="checkbox" name="destaque"${produto.destaque ? ' checked' : ''}> Destaque (abertura da vitrine)</label>
      <div data-aviso></div>
      <div class="acoes">
        <button type="submit" class="botao">Salvar</button>
        ${novo ? '' : '<button type="button" class="botao perigo" data-acao="excluir">Excluir</button>'}
      </div>
    </form>`;

  const form = app.querySelector('form.produto');
  const regiao = form.querySelector('[data-aviso]');
  const areaAtributos = form.querySelector('[data-atributos]');
  const botaoSalvar = form.querySelector('button[type="submit"]');

  // Valores digitados nos atributos, por nome: trocar a categoria mantém os de mesmo nome.
  const valoresAtributos = { ...produto.atributos };
  areaAtributos.addEventListener('input', (evento) => {
    const nome = evento.target.dataset.atributo;
    if (nome) valoresAtributos[nome] = evento.target.value;
  });
  form.categoriaId.addEventListener('change', () => {
    areaAtributos.innerHTML = camposDeAtributo(categoriaDe(form.categoriaId.value), valoresAtributos);
  });

  const ajustarPrecos = () => {
    form.preco.disabled = form.sobConsulta.checked;
    form.precoPromocional.disabled = form.sobConsulta.checked;
  };
  form.sobConsulta.addEventListener('change', ajustarPrecos);
  ajustarPrecos();

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const sobConsulta = form.sobConsulta.checked;
    const precoCentavos = sobConsulta ? null : centavosDoTexto(form.preco.value);
    const precoPromocionalCentavos = sobConsulta ? null : centavosDoTexto(form.precoPromocional.value);
    const recusas = [];
    if (precoCentavos === undefined) recusas.push('Preço: use reais, como 199,90 ou 1.299,00.');
    if (precoPromocionalCentavos === undefined) recusas.push('Preço promocional: use reais, como 199,90 ou 1.299,00.');
    if (recusas.length) {
      regiao.innerHTML = avisoHtml('erro', recusas);
      return;
    }
    const textoEstoque = form.estoque.value.trim();
    const atributos = {};
    for (const campo of areaAtributos.querySelectorAll('input[data-atributo]')) atributos[campo.dataset.atributo] = campo.value;
    const corpo = {
      nome: form.nome.value,
      descricao: form.descricao.value,
      categoriaId: form.categoriaId.value,
      sobConsulta,
      precoCentavos,
      precoPromocionalCentavos,
      // Quem valida é a API: texto que não é inteiro vai como está e volta como erro 422.
      estoque: textoEstoque === '' ? null : /^\d+$/.test(textoEstoque) ? Number(textoEstoque) : textoEstoque,
      ativo: form.ativo.checked,
      destaque: form.destaque.checked,
      imagemUrl: form.imagemUrl.value,
      atributos,
    };
    botaoSalvar.disabled = true;
    try {
      const salvo = novo
        ? await chamar('/admin/produtos', { metodo: 'POST', corpo })
        : await chamar(`/admin/produtos/${encodeURIComponent(id)}`, { metodo: 'PUT', corpo });
      if (!atual()) return;
      avisoPendente = avisoHtml('ok', [`Produto "${salvo.nome}" salvo.`]);
      location.hash = '#/produtos';
    } catch (erro) {
      botaoSalvar.disabled = false;
      mostrarErro(regiao, erro);
    }
  });

  form.querySelector('button[data-acao="excluir"]')?.addEventListener('click', async (evento) => {
    if (!confirm(`Excluir o produto "${produto.nome}"? Esta ação não pode ser desfeita.`)) return;
    const botao = evento.currentTarget;
    botao.disabled = true;
    try {
      await chamar(`/admin/produtos/${encodeURIComponent(id)}`, { metodo: 'DELETE' });
      if (!atual()) return;
      avisoPendente = avisoHtml('ok', [`Produto "${produto.nome}" excluído.`]);
      location.hash = '#/produtos';
    } catch (erro) {
      botao.disabled = false;
      mostrarErro(regiao, erro);
    }
  });
}

// ---------- Categorias ----------

/** "Plataforma, Condição ,Cor," → ["Plataforma", "Condição", "Cor"]. */
const atributosDoTexto = (texto) => texto.split(',').map((parte) => parte.trim()).filter(Boolean);

function camposDeCategoria(categoria) {
  return `
    <div class="duas">
      <label>Nome
        <input type="text" name="nome" value="${esc(categoria.nome)}">
      </label>
      <label>Atributos
        <input type="text" name="atributos" value="${esc(categoria.atributos.join(', '))}">
        <span class="dica">Separados por vírgula, ex.: Plataforma, Condição</span>
      </label>
    </div>`;
}

async function telaCategorias({ atual, aviso }) {
  const categorias = await chamar('/admin/categorias');
  if (!atual()) return;
  const linhas = categorias.map((c) => `
    <form class="categoria bloco formulario" data-categoria="${esc(c.id)}" novalidate>
      ${camposDeCategoria(c)}
      <div class="acoes">
        <button type="submit" class="botao pequeno">Salvar</button>
        <button type="button" class="botao perigo pequeno" data-acao="excluir">Excluir</button>
      </div>
    </form>`).join('');
  app.innerHTML = `
    <div class="cabecalho"><h1>Categorias</h1></div>
    <div data-aviso>${aviso}</div>
    <div class="cartoes">${linhas || '<p class="suave">Nenhuma categoria cadastrada.</p>'}</div>
    <h2>Nova categoria</h2>
    <form class="categoria-nova bloco formulario" novalidate>
      ${camposDeCategoria({ nome: '', atributos: [] })}
      <div class="acoes"><button type="submit" class="botao">Criar categoria</button></div>
    </form>`;

  const regiao = app.querySelector('[data-aviso]');
  const corpoDe = (form) => ({ nome: form.nome.value, atributos: atributosDoTexto(form.atributos.value) });

  /** Faz a chamada; sucesso redesenha a tela com o aviso, erro aparece no topo. */
  async function executar(botao, chamada, mensagem) {
    botao.disabled = true;
    try {
      const resposta = await chamada();
      if (!atual()) return;
      avisoPendente = avisoHtml('ok', [mensagem(resposta)]);
      desenhar({ manter: true });
    } catch (erro) {
      botao.disabled = false;
      mostrarErro(regiao, erro);
      regiao.scrollIntoView({ block: 'nearest' });
    }
  }

  for (const form of app.querySelectorAll('form.categoria[data-categoria]')) {
    const caminho = `/admin/categorias/${encodeURIComponent(form.dataset.categoria)}`;
    form.addEventListener('submit', (evento) => {
      evento.preventDefault();
      executar(form.querySelector('button[type="submit"]'),
        () => chamar(caminho, { metodo: 'PUT', corpo: corpoDe(form) }),
        (c) => `Categoria "${c.nome}" salva.`);
    });
    form.querySelector('button[data-acao="excluir"]').addEventListener('click', (evento) => {
      const nome = form.nome.defaultValue;
      executar(evento.currentTarget,
        () => chamar(caminho, { metodo: 'DELETE' }),
        () => `Categoria "${nome}" excluída.`);
    });
  }

  const nova = app.querySelector('form.categoria-nova');
  nova.addEventListener('submit', (evento) => {
    evento.preventDefault();
    executar(nova.querySelector('button[type="submit"]'),
      () => chamar('/admin/categorias', { metodo: 'POST', corpo: corpoDe(nova) }),
      (c) => `Categoria "${c.nome}" criada.`);
  });
}

// ---------- Pedidos ----------

const ROTULO_STATUS = {
  novo: 'Novo',
  em_atendimento: 'Em atendimento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const opcoesDeStatus = (escolhido) => Object.entries(ROTULO_STATUS)
  .map(([valor, rotulo]) => `<option value="${valor}"${valor === escolhido ? ' selected' : ''}>${rotulo}</option>`).join('');

const rotuloStatus = (status) => ROTULO_STATUS[status] ?? status;

const valorOuSobConsulta = (centavos) => (centavos == null ? 'sob consulta' : moeda(centavos));

function totalDoPedido(pedido) {
  if (pedido.itens.every((item) => item.subtotalCentavos == null)) return 'Sob consulta';
  return moeda(pedido.totalCentavos) + (pedido.temSobConsulta ? ' + itens sob consulta' : '');
}

function blocoDoPedido(pedido) {
  const itens = pedido.itens.map((item) => `
    <tr>
      <td>${esc(item.nome)}</td>
      <td class="numero">${esc(item.quantidade)}</td>
      <td class="numero">${esc(valorOuSobConsulta(item.subtotalCentavos))}</td>
    </tr>`).join('');
  return `
    <details class="bloco" data-pedido="${esc(pedido.numero)}">
      <summary>
        <strong>#${esc(pedido.numero)}</strong>
        <span>${esc(new Date(pedido.criadoEm).toLocaleString('pt-BR'))}</span>
        <span>${esc(pedido.cliente.nome)}</span>
        <span>${esc(totalDoPedido(pedido))}</span>
        <span class="etiqueta" data-rotulo>${esc(rotuloStatus(pedido.status))}</span>
      </summary>
      <p>Telefone: ${esc(pedido.cliente.telefone)}</p>
      <div class="rolagem">
        <table>
          <thead><tr><th>Produto</th><th class="numero">Qtd.</th><th class="numero">Subtotal</th></tr></thead>
          <tbody>${itens}</tbody>
        </table>
      </div>
      <p>Total: ${esc(totalDoPedido(pedido))}</p>
      ${pedido.observacao ? `<p>Observação: ${esc(pedido.observacao)}</p>` : ''}
      <h3>Mensagem enviada</h3>
      <pre class="mensagem">${esc(pedido.mensagem)}</pre>
      <label>Status
        <select name="status">${opcoesDeStatus(pedido.status)}</select>
      </label>
    </details>`;
}

// Filtro escolhido; vale enquanto a página não recarrega.
let filtroPedidos = '';

async function telaPedidos({ atual, aviso }) {
  app.innerHTML = `
    <div class="cabecalho">
      <h1>Pedidos</h1>
      <label>Status
        <select name="filtro-status"><option value="">Todos</option>${opcoesDeStatus(filtroPedidos)}</select>
      </label>
    </div>
    <div data-aviso>${aviso}</div>
    <div class="cartoes" data-pedidos><p class="suave">Carregando…</p></div>`;
  const regiao = app.querySelector('[data-aviso]');
  const lista = app.querySelector('[data-pedidos]');
  const filtro = app.querySelector('select[name="filtro-status"]');

  async function listar(vigente) {
    const consulta = filtroPedidos ? `?status=${encodeURIComponent(filtroPedidos)}` : '';
    const pedidos = await chamar(`/admin/pedidos${consulta}`);
    if (!vigente()) return;
    lista.innerHTML = pedidos.length
      ? pedidos.map(blocoDoPedido).join('')
      : `<p class="suave">${filtroPedidos ? `Nenhum pedido com o status "${esc(rotuloStatus(filtroPedidos))}".` : 'Nenhum pedido ainda.'}</p>`;
  }

  filtro.addEventListener('change', async () => {
    filtroPedidos = filtro.value;
    regiao.innerHTML = '';
    lista.innerHTML = '<p class="suave">Carregando…</p>';
    // Cada filtro é um desenho novo: a resposta de um filtro anterior chega tarde e é ignorada.
    const vigente = novoDesenho();
    try {
      await listar(vigente);
    } catch (erro) {
      if (vigente()) mostrarErro(lista, erro);
    }
  });

  lista.addEventListener('change', async (evento) => {
    const select = evento.target;
    if (select.name !== 'status') return;
    const bloco = select.closest('details[data-pedido]');
    const anterior = select.querySelector('option[selected]')?.value;
    select.disabled = true;
    try {
      const pedido = await chamar(`/admin/pedidos/${encodeURIComponent(bloco.dataset.pedido)}`, {
        metodo: 'PATCH',
        corpo: { status: select.value },
      });
      bloco.querySelector('[data-rotulo]').textContent = rotuloStatus(pedido.status);
      for (const opcao of select.options) opcao.defaultSelected = opcao.value === pedido.status;
      regiao.innerHTML = avisoHtml('ok', [`Pedido #${pedido.numero}: status "${rotuloStatus(pedido.status)}" salvo.`]);
    } catch (erro) {
      if (anterior) select.value = anterior;
      mostrarErro(regiao, erro);
    } finally {
      select.disabled = false;
    }
  });

  await listar(atual);
}

// ---------- Loja ----------

async function telaLoja({ atual, aviso }) {
  const loja = await chamar('/admin/loja');
  if (!atual()) return;
  app.innerHTML = `
    <div class="cabecalho"><h1>Loja</h1></div>
    <form class="loja formulario" novalidate>
      <label>Nome
        <input type="text" name="nome" value="${esc(loja.nome)}">
      </label>
      <label>Slogan
        <input type="text" name="slogan" value="${esc(loja.slogan)}">
      </label>
      <label>WhatsApp do vendedor
        <input type="tel" inputmode="numeric" name="whatsapp" autocomplete="off" value="${esc(loja.whatsapp)}">
        <span class="dica">DDI + DDD + número, só dígitos</span>
      </label>
      <div data-aviso>${aviso}</div>
      <div class="acoes"><button type="submit" class="botao">Salvar</button></div>
    </form>`;
  const form = app.querySelector('form.loja');
  const regiao = form.querySelector('[data-aviso]');
  const botao = form.querySelector('button[type="submit"]');
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    botao.disabled = true;
    try {
      const salva = await chamar('/admin/loja', {
        metodo: 'PUT',
        corpo: { nome: form.nome.value, slogan: form.slogan.value, whatsapp: form.whatsapp.value },
      });
      mostrarNomeDaLoja(salva.nome);
      if (!atual()) return;
      form.nome.value = salva.nome;
      form.slogan.value = salva.slogan;
      form.whatsapp.value = salva.whatsapp;
      regiao.innerHTML = avisoHtml('ok', ['Dados da loja salvos.']);
    } catch (erro) {
      mostrarErro(regiao, erro);
    } finally {
      botao.disabled = false;
    }
  });
}

// ---------- Partida ----------

const TELAS = {
  produtos: telaProdutos,
  produto: telaProduto,
  categorias: telaCategorias,
  pedidos: telaPedidos,
  loja: telaLoja,
};

document.getElementById('sair').addEventListener('click', encerrarSessao);
window.addEventListener('hashchange', () => desenhar());
desenhar();
