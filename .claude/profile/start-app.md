# Profile of /wh:start-app

## Services
Uma loja por processo, sem dependência entre elas e sem etapa de build [docs/prototipo/README.md]
loja jogos — start: `LOJA=jogos PORTA=4101 node prototipo/server.mjs` · stop: `kill <pid>` · health: `GET http://127.0.0.1:4101/api/loja` responde 200 com JSON · log: a saída do processo [CLAUDE.md]
loja impressao3d — start: `LOJA=impressao3d PORTA=4102 node prototipo/server.mjs` · stop: `kill <pid>` · health: `GET http://127.0.0.1:4102/api/loja` responde 200 com JSON · log: a saída do processo [CLAUDE.md]

## Client
Navegador: a loja em `http://localhost:<porta>/` e o admin em `http://localhost:<porta>/admin` [docs/prototipo/README.md]
Sem janela: `curl -fsS http://127.0.0.1:<porta>/api/loja` [docs/prototipo/API.md]

## Alternative
—

## State
Dados em memória, carregados de `prototipo/lojas/<loja>/dados.json` na partida: parar o processo zera produtos editados e pedidos. Não há banco nem arquivo de estado [docs/prototipo/README.md]

## Dev credentials
Admin: senha `admin`, ou o valor de `SENHA_ADMIN` [docs/prototipo/README.md]
WhatsApp dos dados iniciais: `5500000000000`, inválido de propósito; o número real entra pela tela Loja do admin [docs/prototipo/README.md]

## Signals
—
