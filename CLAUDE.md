# andelphgroup

Site de vendas com carrinho e pedido enviado ao vendedor pelo WhatsApp, para duas lojas (jogos de videogame e máquinas de impressão 3D), com um deploy por loja.

## Fase atual

Fase 2, protótipo. As fases estão em `docs/REQUISITOS.md` § 2. A arquitetura (fase 3) é feita pelo dono do projeto; o backend e o front definitivos só começam depois dela.

## Onde está cada coisa

| Caminho | O que é | Leia quando |
|---|---|---|
| `docs/REQUISITOS.md` | requisitos (RF, RNF), decisões tomadas e pontos em aberto | antes de qualquer tarefa |
| `docs/prototipo/README.md` | limites, pastas e como rodar o protótipo | for tocar em `prototipo/` |
| `docs/prototipo/API.md` | contrato da API falsa | for mexer no servidor, nos testes ou numa chamada de tela |
| `docs/prototipo/TELAS.md` | telas, fluxos e roteiros de aceite | for construir ou conferir uma tela |
| `docs/GLOSSARIO.md` | nome de negócio de cada termo e o identificador no código | for nomear ou procurar um conceito |
| `docs/features/README.md` | mapa de features, uma nota por feature | for localizar o que uma tarefa toca |
| `prototipo/` | código do protótipo, descartável | |
| `pending/` | itens em aberto (`P-NNN-*.md`), locais ao clone | for escolher ou executar um item |

## Comandos

```sh
LOJA=jogos PORTA=4101 node prototipo/server.mjs
LOJA=impressao3d PORTA=4102 node prototipo/server.mjs
node --test prototipo/teste/api.test.mjs   # testes de contrato da API
```
