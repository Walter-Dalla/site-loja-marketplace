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

// ---------- Partida ----------

const TELAS = {
  produtos: telaProdutos,
};

document.getElementById('sair').addEventListener('click', encerrarSessao);
window.addEventListener('hashchange', () => desenhar());
desenhar();
