# Profile of /wh:implementation

## Commands
build: — [docs/prototipo/README.md]
suite: `node --test prototipo/teste/api.test.mjs` [docs/prototipo/README.md]
typecheck: `for f in prototipo/server.mjs prototipo/web/*.js; do node --check $f || exit 1; done` [conferido em 2026-11-18]
service: `LOJA=jogos PORTA=<port> node prototipo/server.mjs` [docs/prototipo/README.md]
health: `curl -fsS -o /dev/null http://127.0.0.1:<port>/api/loja` [docs/prototipo/API.md]

## Build
— (sem etapa de build: o Node roda os arquivos como estão) [docs/prototipo/README.md]

## Tests
Area: `node --test --test-name-pattern "<filter>" prototipo/teste/api.test.mjs` (filtra pelo nome do teste) [node --help]
Suite: chave `suite` de § Commands [docs/prototipo/README.md]
Cada grupo de testes sobe o próprio servidor em porta livre (`PORTA=0`), sem depender de serviço já no ar [prototipo/teste/api.test.mjs]
Aceite de tela, sem teste automatizado: os passos de `docs/prototipo/TELAS.md` § Roteiro de aceite da loja e § Roteiro de aceite do admin [docs/prototipo/TELAS.md]

## Checks
Chave `typecheck` de § Commands: sintaxe do servidor e dos scripts do front, por item que toca `.mjs` ou `.js` [conferido em 2026-11-18]. Não há lint nem formatador [docs/prototipo/README.md]

## Disposable service
Chaves `service` e `health` de § Commands. Uma loja por processo: para a outra loja, `LOJA=impressao3d` no lugar de `LOJA=jogos`, em outra porta [docs/prototipo/README.md]
Dados em memória, carregados de `dados.json` na partida: não há estado a nomear nem fixture; reiniciar zera produtos editados e pedidos [docs/prototipo/README.md]
Parar: `kill <pid>` [ambiente]. Senha do admin: `admin`, ou o valor de `SENHA_ADMIN` [docs/prototipo/README.md]

## Contract
`docs/prototipo/API.md` é o contrato da API falsa: rotas, modelo, códigos de erro e o formato exato da mensagem do pedido. Quando o código diverge, o doc vence [docs/prototipo/README.md]
Produtor: `prototipo/server.mjs`. Consumidores: os testes de contrato e os scripts das telas em `prototipo/web/` [docs/prototipo/README.md]
Chaves de `localStorage` e `sessionStorage`: `docs/prototipo/TELAS.md` § Regras comuns [docs/prototipo/TELAS.md]
Sem fixture de contrato (snapshot ou golden file) [docs/prototipo/README.md]

## Union files
`prototipo/web/comum.js` `prototipo/web/base.css` [pending: P-002, P-003]

## Protected files
`CLAUDE.md`, `.claude/profile/*`, `.claude/agents/*` e toda a pasta `docs/` (requisitos, especificação do protótipo, glossário, mapa de features, relatórios) [dono]

## Enricher reading
Sempre: `CLAUDE.md`, `docs/REQUISITOS.md`, `docs/prototipo/README.md` [CLAUDE.md]
Quando a tarefa toca o servidor, os testes ou uma chamada de tela: `docs/prototipo/API.md`. Quando toca uma tela: `docs/prototipo/TELAS.md` [CLAUDE.md]
Antes de qualquer grep: `docs/features/README.md` e `docs/GLOSSARIO.md` [/wh:adopt]

## Visual or e2e QA
Sem harness automatizado. Os roteiros de aceite de `docs/prototipo/TELAS.md` (§ Roteiro de aceite da loja, nas duas lojas; § Roteiro de aceite do admin) são percorridos em navegador real contra o serviço descartável [docs/prototipo/TELAS.md]

## Closing docs
Changelog: —. Status de feature: —. Cleanup: — [/wh:adopt]
Itens em aberto do dono: `pending/`. Dúvida de requisito: § Open questions do item [docs/prototipo/README.md]
Comando novo: `CLAUDE.md` § Comandos e `docs/prototipo/README.md` § Rodar [CLAUDE.md]
Glossário: `docs/GLOSSARIO.md`. Mapa de features: `docs/features/README.md`, pela skill `/wh:feature-docs` [/wh:adopt]

## Report
`docs/reports/<date>-<slug>.md` [padrão da skill]

## Models
— (o padrão da skill) [dono]

## Worktree commands
—
