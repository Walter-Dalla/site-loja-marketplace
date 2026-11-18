// Utilitários compartilhados pela loja e pelo admin.

const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa texto para uso em HTML (conteúdo e atributos). Todo dado dinâmico passa por aqui. */
export const esc = (valor) => String(valor ?? '').replace(/[&<>"']/g, (c) => ENTIDADES[c]);

const formatoMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const moeda = (centavos) => formatoMoeda.format(centavos / 100);

export class ErroApi extends Error {
  constructor(status, corpo) {
    super(corpo?.erro ?? `Erro ${status}`);
    this.status = status;
    this.detalhes = Array.isArray(corpo?.detalhes) ? corpo.detalhes : [];
  }
}

export async function api(caminho, { metodo = 'GET', corpo, token } = {}) {
  const cabecalhos = {};
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
  if (token) cabecalhos.Authorization = `Bearer ${token}`;
  const resposta = await fetch(`/api${caminho}`, {
    method: metodo,
    headers: cabecalhos,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const dados = resposta.status === 204 ? null : await resposta.json().catch(() => null);
  if (!resposta.ok) throw new ErroApi(resposta.status, dados);
  return dados;
}

/** Lista de mensagens de um erro, para exibir ao usuário. */
export const linhasDoErro = (erro) => (erro.detalhes?.length ? erro.detalhes : [erro.message]);

export function avisoHtml(tipo, linhas) {
  if (!linhas?.length) return '';
  const corpo = linhas.length === 1
    ? esc(linhas[0])
    : `<ul>${linhas.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
  return `<div class="aviso ${tipo === 'erro' ? 'erro' : 'ok'}" role="${tipo === 'erro' ? 'alert' : 'status'}">${corpo}</div>`;
}

/** Imagem do produto, ou um bloco colorido com as iniciais quando não há imagem. */
export function capa(produto) {
  if (produto.imagemUrl) return `<img class="capa" src="${esc(produto.imagemUrl)}" alt="" loading="lazy">`;
  const matiz = [...produto.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const iniciais = produto.nome.split(/\s+/).slice(0, 2).map((parte) => parte[0] ?? '').join('').toUpperCase();
  return `<div class="capa" style="--matiz:${matiz}" aria-hidden="true">${esc(iniciais)}</div>`;
}

/** Preço que vale para o produto, em centavos; null quando é sob consulta. */
export const precoDe = (p) => (p.sobConsulta ? null : p.precoPromocionalCentavos ?? p.precoCentavos);

export function precoHtml(p) {
  if (p.sobConsulta) return '<span class="preco">Sob consulta</span>';
  if (p.precoPromocionalCentavos != null) {
    return `<s>${moeda(p.precoCentavos)}</s><span class="preco">${moeda(p.precoPromocionalCentavos)}</span>`;
  }
  return `<span class="preco">${moeda(p.precoCentavos)}</span>`;
}
