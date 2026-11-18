// Testes de contrato da API falsa (docs/prototipo/API.md). Cada grupo sobe o próprio servidor em porta livre.
// Rodar: node --test prototipo/teste/api.test.mjs
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SERVIDOR = fileURLToPath(new URL('../server.mjs', import.meta.url));
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
