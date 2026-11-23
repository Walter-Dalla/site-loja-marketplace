---
aliases: [admin, painel do admin, área administrativa]
---
# Admin

Área com login em que o admin cadastra produtos e categorias, acompanha os pedidos e configura a loja (RF-20 a RF-26).

Contrato: `docs/prototipo/API.md` § Rotas de admin. Telas: `docs/prototipo/TELAS.md` § Admin.

## Símbolos de entrada

- `validarProduto`, `validarCategoria` — regras do cadastro de produto e de categoria
- `validarLoja` — regras da configuração da loja
- `SENHA_ADMIN`, `ADMIN` — login e marca das rotas que exigem autenticação
- `chamar` (tela do admin) — toda chamada de admin leva o token guardado em `sessionStorage`; um 401 encerra a sessão e volta ao login (servidor reiniciado esquece os tokens)

## Interações

- [Catálogo e vitrine](catalogo.md) — os produtos e as categorias cadastrados aqui são os que a vitrine lista
- [Carrinho e pedido](carrinho-pedido.md) — lista os pedidos criados pelo cliente e altera o status
- [Multi-loja e customização](multi-loja.md) — a tela Loja edita o nome e o WhatsApp do vendedor da instância
