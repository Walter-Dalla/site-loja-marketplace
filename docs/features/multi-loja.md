---
aliases: [multi-loja, duas lojas, deploy por loja, customização por loja]
---
# Multi-loja e customização

O mesmo código serve as duas lojas, uma instância por deploy; o que muda de uma para outra é dado e arquivo de customização (RF-40 a RF-43).

Regras: `docs/prototipo/README.md` § Rodar e § Customização por loja.

## Símbolos de entrada

- `LOJA`, `PASTA_LOJA` — a loja do processo e a pasta `prototipo/lojas/<loja>/` com `loja.json` e `dados.json`
- `PASTAS_WEB`, `atenderEstatico` — o arquivo da pasta da loja substitui o da base

## Interações

- [Catálogo e vitrine](catalogo.md) — as categorias, os atributos e os produtos iniciais vêm de `dados.json` da loja
- [Admin](admin.md) — a configuração inicial vem de `loja.json` e é editada na tela Loja
