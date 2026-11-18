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

// ---------- Rotas ----------

const hrefProduto = (id) => `#/produto/${esc(encodeURIComponent(id))}`;

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
    await telaVitrine(atual);
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
