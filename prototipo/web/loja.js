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
    else if (rota === '#/carrinho') await telaCarrinho(atual);
    else if (rota === '#/pedido') telaPedido();
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

// ---------- Carrinho ----------

/** Só endereço do WhatsApp vira destino de janela ou href; qualquer outro vale como ausente. */
const linkWhatsApp = (link) => (typeof link === 'string' && link.startsWith('https://wa.me/') ? link : null);

/** Texto do total: soma dos itens com preço, seguida de "+ itens sob consulta" quando houver. */
function textoTotal(centavos, temSobConsulta, soSobConsulta) {
  if (soSobConsulta) return 'Sob consulta';
  return `${moeda(centavos)}${temSobConsulta ? ' + itens sob consulta' : ''}`;
}

async function telaCarrinho(atual) {
  if (!lerCarrinho().length) {
    app.innerHTML = `<h1>Carrinho</h1>${voltarVitrine('Seu carrinho está vazio.')}`;
    return;
  }
  const params = new URLSearchParams({ ids: lerCarrinho().map((i) => i.produtoId).join(','), porPagina: '50' });
  const { itens } = await api(`/produtos?${params}`);
  if (!atual()) return;

  const produtos = new Map(itens.map((p) => [p.id, p]));
  /** Produto à venda: veio da API e está disponível. Os demais ficam fora do total e do pedido. */
  const aVenda = (id) => produtos.get(id)?.disponivel === true;
  const subtotal = (id, quantidade) => {
    const preco = precoDe(produtos.get(id));
    return preco === null ? 'Sob consulta' : moeda(preco * quantidade);
  };

  function itemHtml({ produtoId, quantidade }) {
    const p = produtos.get(produtoId);
    const venda = aVenda(produtoId);
    const nome = p ? p.nome : 'Produto fora de venda';
    let detalhe = '<span class="etiqueta alerta">Não está mais à venda</span>';
    if (p && !venda) detalhe = '<span class="etiqueta alerta">Indisponível</span>';
    if (venda) detalhe = `<span class="preco-bloco">${precoHtml(p)}</span> <span class="suave">cada</span>`;
    return `<li class="item${venda ? '' : ' fora'}" data-produto="${esc(produtoId)}">
      <div>
        <h3>${p ? `<a href="${hrefProduto(produtoId)}">${esc(nome)}</a>` : esc(nome)}</h3>
        ${detalhe}
      </div>
      <div class="subtotal">${venda ? esc(subtotal(produtoId, quantidade)) : '—'}</div>
      <div class="controles">
        ${venda
          ? `<input type="number" name="quantidade" min="1" max="99" step="1" value="${esc(quantidade)}" inputmode="numeric" aria-label="Quantidade de ${esc(nome)}">`
          : `<span class="suave">Quantidade: ${esc(quantidade)}</span>`}
        <button type="button" class="botao secundario pequeno" data-acao="remover">Remover</button>
      </div>
    </li>`;
  }

  function totalHtml(carrinho) {
    let soma = 0;
    let comPreco = false;
    let sobConsulta = false;
    for (const { produtoId, quantidade } of carrinho) {
      if (!aVenda(produtoId)) continue;
      const preco = precoDe(produtos.get(produtoId));
      if (preco === null) sobConsulta = true;
      else {
        soma += preco * quantidade;
        comPreco = true;
      }
    }
    return `<span>Total</span><span>${esc(textoTotal(soma, sobConsulta, sobConsulta && !comPreco))}</span>`;
  }

  const carrinho = lerCarrinho();
  app.innerHTML = `
    <h1>Carrinho</h1>
    <ul class="itens">${carrinho.map(itemHtml).join('')}</ul>
    <div class="total">${totalHtml(carrinho)}</div>
    <div class="retorno"></div>
    <form class="pedido formulario" novalidate>
      <h2>Seus dados</h2>
      <label>Nome
        <input type="text" name="nome" autocomplete="name">
      </label>
      <label>Telefone com DDD
        <input type="tel" name="telefone" autocomplete="tel" inputmode="tel">
      </label>
      <label>Observação <span class="dica">opcional</span>
        <textarea name="observacao"></textarea>
      </label>
      <p class="dica">Nome e telefone são usados só para atender este pedido.</p>
      <button type="submit" class="botao">Enviar pedido pelo WhatsApp</button>
    </form>`;

  const lista = app.querySelector('ul.itens');
  const total = app.querySelector('.total');
  const retorno = app.querySelector('.retorno');
  const formulario = app.querySelector('form.pedido');

  // A lista e o total mudam no lugar: o formulário não é redesenhado e guarda o que o cliente digitou.
  lista.addEventListener('input', (evento) => {
    const campo = evento.target;
    if (campo.name !== 'quantidade') return;
    const quantidade = quantidadeValida(campo.value);
    if (quantidade === null) return;
    const id = campo.closest('li.item').dataset.produto;
    const atualizado = lerCarrinho().map((i) => (i.produtoId === id ? { ...i, quantidade } : i));
    gravarCarrinho(atualizado);
    campo.closest('li.item').querySelector('.subtotal').textContent = subtotal(id, quantidade);
    total.innerHTML = totalHtml(atualizado);
  });
  lista.addEventListener('change', (evento) => {
    const campo = evento.target;
    if (campo.name !== 'quantidade' || quantidadeValida(campo.value) !== null) return;
    const id = campo.closest('li.item').dataset.produto;
    campo.value = String(lerCarrinho().find((i) => i.produtoId === id)?.quantidade ?? 1);
  });
  lista.addEventListener('click', (evento) => {
    const botao = evento.target.closest('button[data-acao="remover"]');
    if (!botao) return;
    const li = botao.closest('li.item');
    const restante = lerCarrinho().filter((i) => i.produtoId !== li.dataset.produto);
    gravarCarrinho(restante);
    if (!restante.length) {
      desenhar();
      return;
    }
    li.remove();
    total.innerHTML = totalHtml(restante);
  });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const botao = formulario.querySelector('button[type="submit"]');
    if (botao.disabled) return;
    // Aberta no próprio gesto do cliente; aberta depois da resposta, o navegador a bloquearia.
    const janela = window.open('', '_blank');
    botao.disabled = true;
    retorno.innerHTML = '';
    const dados = new FormData(formulario);
    const corpo = {
      cliente: { nome: dados.get('nome'), telefone: dados.get('telefone') },
      observacao: dados.get('observacao'),
      itens: lerCarrinho().filter((i) => aVenda(i.produtoId)),
    };
    let pedido;
    try {
      pedido = await api('/pedidos', { metodo: 'POST', corpo });
    } catch (erro) {
      janela?.close();
      retorno.innerHTML = avisoHtml('erro', linhasDoErro(erro));
      botao.disabled = false;
      return;
    }
    sessionStorage.setItem('ultimoPedido', JSON.stringify(pedido));
    gravarCarrinho([]);
    const link = linkWhatsApp(pedido.linkWhatsApp);
    if (janela && link) janela.location.href = link;
    else janela?.close();
    location.hash = '#/pedido';
  });
}

// ---------- Confirmação ----------

/** Último pedido da sessão, se tiver o formato da resposta de POST /api/pedidos; senão null. */
function lerUltimoPedido() {
  try {
    const pedido = JSON.parse(sessionStorage.getItem('ultimoPedido'));
    const valido = pedido !== null && typeof pedido === 'object'
      && Number.isInteger(pedido.numero) && Number.isInteger(pedido.totalCentavos)
      && typeof pedido.mensagem === 'string';
    return valido ? pedido : null;
  } catch {
    return null;
  }
}

function telaPedido() {
  const pedido = lerUltimoPedido();
  if (!pedido) {
    app.innerHTML = `<h1>Pedido</h1>${voltarVitrine('Nenhum pedido enviado nesta sessão.')}`;
    return;
  }
  const temSobConsulta = pedido.temSobConsulta === true;
  const soSobConsulta = temSobConsulta && pedido.mensagem.includes('*Total: sob consulta*');
  const link = linkWhatsApp(pedido.linkWhatsApp);
  app.innerHTML = `
    <h1>Pedido nº ${esc(pedido.numero)} registrado</h1>
    <p>Total: <strong>${esc(textoTotal(pedido.totalCentavos, temSobConsulta, soSobConsulta))}</strong></p>
    <p class="suave">${link
      ? 'Se o WhatsApp não abriu, ou se você ainda não enviou a mensagem, use o botão abaixo.'
      : 'O link do WhatsApp deste pedido não está disponível. Envie a mensagem abaixo ao vendedor.'}</p>
    <pre class="mensagem">${esc(pedido.mensagem)}</pre>
    <p class="acoes">
      ${link ? `<a class="botao" data-acao="abrir-whatsapp" href="${esc(link)}" target="_blank" rel="noopener">Abrir WhatsApp</a>` : ''}
      <a class="botao secundario" href="#/">Voltar à vitrine</a>
    </p>`;
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
