---
aliases: [catálogo, vitrine, produtos, categorias]
---
# Catálogo e vitrine

O que o cliente vê dos produtos: listagem paginada, filtro por categoria e por atributo, busca, destaque, preço e disponibilidade (RF-01 a RF-08).

Contrato: `docs/prototipo/API.md` § Modelo e § Rotas públicas. Telas: `docs/prototipo/TELAS.md` § Loja (Vitrine e Produto).

## Símbolos de entrada

- `listarProdutos` — filtros, busca e paginação de `GET /api/produtos`
- `visaoPublica` — os campos de um produto que a vitrine pode ver
- `categoriasPublicas` — categorias com o total de produtos e os valores de cada atributo
- `precoEfetivo`, `disponivel` — regras de preço e de disponibilidade

## Interações

- [Carrinho e pedido](carrinho-pedido.md) — o pedido recalcula preço e disponibilidade com as mesmas regras
- [Admin](admin.md) — cadastra os produtos e as categorias que a vitrine lista; cada produto guarda a origem (RF-30)
