---
aliases: [carrinho, pedido, pedidos, fechar pedido, envio pelo WhatsApp]
---
# Carrinho e pedido

O cliente monta o carrinho no navegador, informa nome e telefone, e o servidor salva o pedido e devolve o link `wa.me` com a mensagem pronta para o vendedor (RF-10 a RF-16).

Contrato: `docs/prototipo/API.md` § `POST /api/pedidos` e § Mensagem e link. Telas: `docs/prototipo/TELAS.md` § Loja (Carrinho e Confirmação).

## Símbolos de entrada

- `criarPedido` — valida cliente e itens, recalcula preço e disponibilidade, salva o pedido
- `montarMensagem` — texto do pedido enviado ao vendedor
- `STATUS` — valores do status do pedido
- `lerCarrinho`, `gravarCarrinho` (tela da loja) — carrinho no `localStorage`, uma chave por loja; leitura saneada (formato inválido vale inteiro como vazio; até 50 itens, quantidade de 1 a 99) e escrita única

## Interações

- [Catálogo e vitrine](catalogo.md) — preço e disponibilidade saem sempre do catálogo do servidor
- [Admin](admin.md) — lista os pedidos e altera o status
- [Multi-loja e customização](multi-loja.md) — o nome e o WhatsApp do vendedor vêm da configuração da loja
