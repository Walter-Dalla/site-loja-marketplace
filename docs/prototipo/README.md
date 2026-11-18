# Protótipo

Fase 2 de [REQUISITOS.md](../REQUISITOS.md): telas navegáveis consumindo uma API falsa, para o dono validar o fluxo e o contrato antes de desenhar a arquitetura. É **descartável**: nada daqui vira base do backend ou do front definitivos.

| Doc | Leia quando |
|---|---|
| [API.md](API.md) | for mexer no servidor, nos testes, ou chamar a API a partir de uma tela |
| [TELAS.md](TELAS.md) | for construir ou conferir uma tela da loja ou do admin |

Quando o código e estes docs divergem, os docs vencem. Dúvida de requisito não se resolve no código: vira pergunta ao dono (seção "Open questions" do item em `pending/`).

## Limites

- Node 22 ou mais novo, só módulos nativos (`node:http`, `node:test`, …). Sem `package.json`, sem dependências, sem etapa de build.
- Front em HTML, CSS e JavaScript puro (módulos ES), servido pelo mesmo servidor.
- Dados em memória, carregados de `lojas/<loja>/dados.json` na partida. Reiniciar o servidor zera produtos editados e pedidos.
- Login de admin por senha fixa. Existe só para mostrar a fronteira entre rotas públicas e de admin.
- O servidor escuta em `127.0.0.1`.

## Rodar

Uma loja por processo, como será no deploy real (RF-40, RF-41):

```sh
LOJA=jogos PORTA=4101 node prototipo/server.mjs
LOJA=impressao3d PORTA=4102 node prototipo/server.mjs
```

Loja em `http://localhost:<porta>/`, admin em `http://localhost:<porta>/admin`.

| Variável | Padrão | Papel |
|---|---|---|
| `LOJA` | `jogos` | nome de uma pasta de `prototipo/lojas/` |
| `PORTA` | `4101` | porta HTTP |
| `HOST` | `127.0.0.1` | endereço de escuta |
| `SENHA_ADMIN` | `admin` | senha do login de admin |

## Pastas

| Caminho | Papel |
|---|---|
| `prototipo/server.mjs` | API falsa e entrega dos arquivos estáticos |
| `prototipo/web/` | base do front, comum a todas as lojas |
| `prototipo/lojas/<loja>/loja.json` | nome, slogan e WhatsApp do vendedor |
| `prototipo/lojas/<loja>/dados.json` | categorias e produtos iniciais |
| `prototipo/lojas/<loja>/web/` | customização da loja |
| `prototipo/teste/` | testes de contrato da API |

## Customização por loja

Para cada arquivo estático pedido, o servidor procura primeiro em `lojas/<loja>/web/` e depois em `web/`. Um arquivo com o mesmo nome na pasta da loja substitui o da base (RF-42). Hoje cada loja substitui `tema.css` (cores, fonte, raio) e `faixa.html` (bloco de abertura da vitrine).

O que muda de uma loja para outra é dado ou arquivo de customização: categorias, atributos, produtos, tema, textos. `server.mjs` e os `.js` de `web/` são iguais para todas e não têm ramo por nome de loja (RF-43).

## Número de WhatsApp dos dados iniciais

`loja.json` traz `5500000000000`, um número inválido de propósito (DDD 00), para que nenhum pedido de teste chegue a uma pessoa real. O número verdadeiro entra pelo admin, tela Loja.
