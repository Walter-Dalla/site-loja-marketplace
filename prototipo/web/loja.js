// Telas da loja: vitrine, produto, carrinho e confirmação (docs/prototipo/TELAS.md § Loja).
import { esc, moeda, api, linhasDoErro, avisoHtml, capa, precoDe, precoHtml } from './comum.js';

const app = document.getElementById('app');
const contador = document.getElementById('carrinho-qtd');
const CARREGANDO = '<p class="suave">Carregando…</p>';
const POR_PAGINA = 8;

/** Loja aberta (GET /api/loja); o id compõe a chave do carrinho. */
let loja = null;
/** Número do desenho atual: resposta que chega depois de outro desenho começar é ignorada. */
let sequencia = 0;
/** Rota do último desenho, para só mostrar "Carregando…" ao trocar de tela. */
let rotaDesenhada = '';

/** Filtros da vitrine, em memória: voltar do produto mantém, recarregar zera. */
const filtros = { busca: '', categoria: '', atributos: {}, pagina: 1 };

// ---------- Carrinho guardado ----------

const chaveCarrinho = () => `carrinho:${loja.id}`;

/** Carrinho do localStorage, saneado: qualquer formato fora da regra vale inteiro como vazio. */
function lerCarrinho() {
  let dado;
  try {
    dado = JSON.parse(localStorage.getItem(chaveCarrinho()) ?? '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(dado) || dado.length > 50) return [];
  const vistos = new Set();
  for (const entrada of dado) {
    const valida = entrada !== null && typeof entrada === 'object'
      && typeof entrada.produtoId === 'string'
      && Number.isInteger(entrada.quantidade) && entrada.quantidade >= 1 && entrada.quantidade <= 99
      && !vistos.has(entrada.produtoId);
    if (!valida) return [];
    vistos.add(entrada.produtoId);
  }
  return dado.map(({ produtoId, quantidade }) => ({ produtoId, quantidade }));
}

function atualizarContador(carrinho = lerCarrinho()) {
  contador.textContent = String(carrinho.reduce((soma, item) => soma + item.quantidade, 0));
}

/** Única escrita do carrinho: grava (vazio remove a chave) e atualiza o contador. */
function gravarCarrinho(carrinho) {
  if (carrinho.length) localStorage.setItem(chaveCarrinho(), JSON.stringify(carrinho));
  else localStorage.removeItem(chaveCarrinho());
  atualizarContador(carrinho);
}

/** Quantidade digitada, se for inteira de 1 a 99; senão null. */
function quantidadeValida(texto) {
  const n = Number(texto);
  return Number.isInteger(n) && n >= 1 && n <= 99 ? n : null;
}

// ---------- Rotas ----------

const hrefProduto = (id) => `#/produto/${esc(encodeURIComponent(id))}`;

function decodificar(trecho) {
  try {
    return decodeURIComponent(trecho);
  } catch {
    return trecho;
  }
}

const voltarVitrine = (texto) => `<p>${esc(texto)}</p><p><a class="botao secundario" href="#/">Voltar à vitrine</a></p>`;

/** Desenha em #app a tela da rota do hash; hash desconhecido cai na vitrine. */
async function desenhar() {
  const minha = ++sequencia;
  const atual = () => minha === sequencia;
  const hash = location.hash;
  const rota = hash.startsWith('#/produto/') ? 'produto' : ['#/carrinho', '#/pedido'].includes(hash) ? hash : 'vitrine';
  if (rota !== rotaDesenhada || rota === 'produto') {
    app.innerHTML = CARREGANDO;
    window.scrollTo(0, 0);
  }
  rotaDesenhada = rota;
  try {
    if (rota === 'produto') await telaProduto(decodificar(hash.slice('#/produto/'.length)), atual);
    else await telaVitrine(atual);
  } catch (erro) {
    if (atual()) app.innerHTML = avisoHtml('erro', linhasDoErro(erro));
  }
}

// ---------- Vitrine ----------

function cartaoHtml(p) {
  return `<a class="cartao" href="${hrefProduto(p.id)}">
    ${capa(p)}
    <h3>${esc(p.nome)}</h3>
    ${p.disponivel ? '' : '<span class="etiqueta alerta">Indisponível</span>'}
    <div class="preco-bloco">${precoHtml(p)}</div>
  </a>`;
}

const filtroAtivo = () => Boolean(filtros.busca || filtros.categoria || Object.keys(filtros.atributos).length);

function mudarFiltro(mudanca) {
  mudanca();
  filtros.pagina = 1;
  desenhar();
}

async function telaVitrine(atual) {
  const params = new URLSearchParams({ pagina: String(filtros.pagina), porPagina: String(POR_PAGINA) });
  if (filtros.busca) params.set('busca', filtros.busca);
  if (filtros.categoria) params.set('categoria', filtros.categoria);
  for (const [nome, valor] of Object.entries(filtros.atributos)) params.set(`a.${nome}`, valor);
  const abertura = !filtroAtivo() && filtros.pagina === 1;

  const [categorias, lista, destaques, faixa] = await Promise.all([
    api('/categorias'),
    api(`/produtos?${params}`),
    abertura ? api(`/produtos?${new URLSearchParams({ destaque: '1', porPagina: '4' })}`) : null,
    abertura ? fetch('/faixa.html').then((r) => (r.ok ? r.text() : '')).catch(() => '') : '',
  ]);
  if (!atual()) return;

  const categoria = categorias.find((c) => c.id === filtros.categoria);
  const totalGeral = categorias.reduce((soma, c) => soma + c.total, 0);
  const chip = (id, nome, total) => `<button type="button" class="chip" data-categoria="${esc(id)}" aria-pressed="${filtros.categoria === id}">${esc(nome)} (${esc(total)})</button>`;
  const atributos = (categoria?.atributos ?? []).filter((a) => a.valores.length);
  const paginas = Math.ceil(lista.total / POR_PAGINA);

  app.innerHTML = `
    ${abertura && faixa ? `<section class="faixa">${faixa}</section>` : ''}
    ${abertura && destaques.itens.length ? `<section class="destaques"><h2>Destaques</h2><div class="grade">${destaques.itens.map(cartaoHtml).join('')}</div></section>` : ''}
    <section class="filtros">
      <form class="busca" role="search">
        <input type="search" name="busca" value="${esc(filtros.busca)}" placeholder="Buscar produtos" aria-label="Buscar produtos">
        <button type="submit" class="botao">Buscar</button>
      </form>
      <div class="chips">
        ${chip('', 'Todos', totalGeral)}
        ${categorias.map((c) => chip(c.id, c.nome, c.total)).join('')}
      </div>
      ${atributos.length ? `<div class="atributos">${atributos.map((a) => `
        <label>${esc(a.nome)}
          <select data-atributo="${esc(a.nome)}">
            <option value="">Todos</option>
            ${a.valores.map((v) => `<option value="${esc(v)}"${filtros.atributos[a.nome] === v ? ' selected' : ''}>${esc(v)}</option>`).join('')}
          </select>
        </label>`).join('')}</div>` : ''}
    </section>
    <section class="resultado">
      ${lista.total ? `
        <p class="suave">${lista.total === 1 ? '1 produto encontrado' : `${esc(lista.total)} produtos encontrados`}</p>
        <div class="grade">${lista.itens.map(cartaoHtml).join('')}</div>
        ${paginas > 1 ? `<nav class="paginacao" aria-label="Páginas">
          <button type="button" class="botao secundario pequeno" data-pagina="anterior"${filtros.pagina <= 1 ? ' disabled' : ''}>Anterior</button>
          <span>Página ${esc(filtros.pagina)} de ${esc(paginas)}</span>
          <button type="button" class="botao secundario pequeno" data-pagina="proxima"${filtros.pagina >= paginas ? ' disabled' : ''}>Próxima</button>
        </nav>` : ''}` : `
        <p>Nenhum produto encontrado.</p>
        <button type="button" class="botao secundario" data-acao="limpar-filtros">Limpar filtros</button>`}
    </section>`;

  app.querySelector('form.busca').addEventListener('submit', (evento) => {
    evento.preventDefault();
    const busca = new FormData(evento.currentTarget).get('busca').trim();
    mudarFiltro(() => { filtros.busca = busca; });
  });
  for (const botao of app.querySelectorAll('button.chip')) {
    botao.addEventListener('click', () => mudarFiltro(() => {
      filtros.categoria = botao.dataset.categoria;
      filtros.atributos = {};
    }));
  }
  for (const select of app.querySelectorAll('select[data-atributo]')) {
    select.addEventListener('change', () => mudarFiltro(() => {
      if (select.value) filtros.atributos[select.dataset.atributo] = select.value;
      else delete filtros.atributos[select.dataset.atributo];
    }));
  }
  for (const botao of app.querySelectorAll('button[data-pagina]')) {
    botao.addEventListener('click', () => {
      filtros.pagina += botao.dataset.pagina === 'proxima' ? 1 : -1;
      desenhar();
    });
  }
  app.querySelector('button[data-acao="limpar-filtros"]')?.addEventListener('click', () => mudarFiltro(() => {
    filtros.busca = '';
    filtros.categoria = '';
    filtros.atributos = {};
  }));
}

// ---------- Produto ----------

async function telaProduto(id, atual) {
  let p;
  try {
    if (!id) throw Object.assign(new Error('Produto não encontrado.'), { status: 404 });
    p = await api(`/produtos/${encodeURIComponent(id)}`);
  } catch (erro) {
    if (!atual()) return;
    app.innerHTML = erro.status === 404
      ? voltarVitrine('Este produto não existe ou saiu da loja.')
      : avisoHtml('erro', linhasDoErro(erro)) + voltarVitrine('Não foi possível abrir o produto.');
    return;
  }
  if (!atual()) return;

  const atributos = Object.entries(p.atributos ?? {});
  const bloqueado = p.disponivel ? '' : ' disabled';
  app.innerHTML = `
    <p><a href="#/">← Vitrine</a></p>
    <article class="produto">
      ${capa(p)}
      <div>
        <h1>${esc(p.nome)}</h1>
        ${p.disponivel ? '' : '<span class="etiqueta alerta">Indisponível</span>'}
        <div class="preco-bloco">${precoHtml(p)}</div>
        <dl class="ficha">${atributos.map(([nome, valor]) => `<dt>${esc(nome)}</dt><dd>${esc(valor)}</dd>`).join('')}</dl>
        <p class="descricao">${esc(p.descricao)}</p>
        <div class="compra">
          <label>Quantidade
            <input type="number" name="quantidade" min="1" max="99" step="1" value="1" inputmode="numeric"${bloqueado}>
          </label>
          <button type="button" class="botao" data-acao="adicionar"${bloqueado}>Adicionar ao carrinho</button>
        </div>
        <div class="retorno"></div>
      </div>
    </article>`;

  const retorno = app.querySelector('.retorno');
  app.querySelector('button[data-acao="adicionar"]').addEventListener('click', () => {
    const quantidade = quantidadeValida(app.querySelector('input[name="quantidade"]').value);
    if (quantidade === null) {
      retorno.innerHTML = avisoHtml('erro', ['Quantidade: de 1 a 99.']);
      return;
    }
    const carrinho = lerCarrinho();
    const item = carrinho.find((i) => i.produtoId === p.id);
    if (!item && carrinho.length >= 50) {
      retorno.innerHTML = avisoHtml('erro', ['O carrinho aceita até 50 produtos diferentes.']);
      return;
    }
    let texto = 'Produto adicionado ao carrinho.';
    if (item) {
      if (item.quantidade + quantidade > 99) texto = 'O carrinho ficou com 99 deste produto, o máximo por pedido.';
      item.quantidade = Math.min(99, item.quantidade + quantidade);
    } else {
      carrinho.push({ produtoId: p.id, quantidade });
    }
    try {
      gravarCarrinho(carrinho);
    } catch {
      retorno.innerHTML = avisoHtml('erro', ['Não foi possível guardar o carrinho neste navegador.']);
      return;
    }
    retorno.innerHTML = `<div class="aviso ok" role="status">${esc(texto)} <a href="#/carrinho">Ver carrinho</a></div>`;
  });
}

// ---------- Partida ----------

async function iniciar() {
  try {
    loja = await api('/loja');
  } catch (erro) {
    app.innerHTML = avisoHtml('erro', linhasDoErro(erro));
    return;
  }
  document.getElementById('loja-nome').textContent = loja.nome;
  document.getElementById('loja-slogan').textContent = loja.slogan;
  document.title = loja.nome;
  atualizarContador();
  window.addEventListener('hashchange', desenhar);
  desenhar();
}

iniciar();
