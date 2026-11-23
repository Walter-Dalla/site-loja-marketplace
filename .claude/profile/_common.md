# Common profile

## Clone
O checkout atual (Linux no WSL2); não há segundo checkout [ambiente]

## Toolchain
Node 22 ou mais novo, só módulos nativos: sem manifesto de pacote, sem dependências, sem etapa de build [docs/prototipo/README.md]
HTTP local: `curl`. Scripts do harness: `python3` e `bash`. Encerrar um processo: `kill <pid>` [ambiente]
O servidor escuta em `127.0.0.1`, dentro do WSL; a variável `HOST` muda o endereço [docs/prototipo/README.md]

## Git
Branch principal: `main`. Remoto de PR: `origin` (GitHub, repositório Walter-Dalla/site-loja-marketplace, público) [git remote]
`pending/`, `retro/` e o índice do CodeGraph são locais ao clone, fora do git [.gitignore]

## Ports
Do dono (só `/wh:start-app` usa): `4101` (loja jogos) e `4102` (loja impressao3d) [CLAUDE.md]
Agentes de `/wh:implementation` (6 portas): `4110–4115` [dono]
QA visual ou e2e: de `4118` para cima, a primeira livre [dono]

## Navigation
Sem índice do CodeGraph: `grep` e `Read`. Indexar é decisão do dono (`codegraph init -y .`) [/wh:adopt]
O código é `prototipo/` (`.mjs`, `.js`, HTML, CSS, JSON) [docs/prototipo/README.md]

## Docs
`CLAUDE.md` — mapa do repo e fase atual [CLAUDE.md]
`docs/REQUISITOS.md` — requisitos (RF, RNF), decisões tomadas e pontos em aberto [CLAUDE.md]
`docs/prototipo/README.md` — limites, pastas e como rodar o protótipo; regra de que o doc vence o código [CLAUDE.md]
`docs/prototipo/API.md` — contrato da API falsa [CLAUDE.md]
`docs/prototipo/TELAS.md` — telas, fluxos e roteiros de aceite [CLAUDE.md]
`docs/GLOSSARIO.md` — nome de negócio de cada termo e o identificador no código [/wh:adopt]
`docs/features/README.md` — mapa de features, uma nota por feature [/wh:adopt]
`pending/` — itens em aberto do dono, um arquivo por item (formato: `PENDING.md` da skill `implementation` do plugin) [CLAUDE.md]
`retro/` — retros salvas por `/wh:retro` [.gitignore]

## Limits
Arquitetura (fase 3), backend e front definitivos são do dono: nenhum agente os começa [CLAUDE.md]
Dúvida de requisito vira pergunta ao dono, não decisão no código [docs/prototipo/README.md]
Nenhum número de WhatsApp real em dado inicial ou teste: o padrão é `5500000000000`, inválido de propósito [docs/prototipo/README.md]
Repositório público: nenhum segredo nem dado pessoal em commit [git remote]
Fora de alcance: as portas do dono, arquivos fora do repo e do scratchpad [ambiente]
