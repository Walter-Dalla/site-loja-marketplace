# Glossário

Nome de negócio de cada termo e o identificador que o representa no código. Os identificadores são do protótipo (`prototipo/`), descartável: a coluna Código muda quando o backend definitivo nascer; a coluna Negócio fica.

## Catálogo

| Negócio | Código | Evite / nota |
|---|---|---|
| Produto | `validarProduto`, `visaoPublica` | A visão do admin e a visão pública têm campos diferentes: `docs/prototipo/API.md` § Modelo |
| Categoria | `categoriaId`, `validarCategoria`, `categoriasPublicas` | Define a lista de atributos dos seus produtos (RF-22) |
| Atributo | `atributos` | Ex.: Plataforma, Tecnologia. Resolve por dado a diferença entre as lojas (RF-43) |
| Vitrine | `listarProdutos` | Listagem pública: só produtos ativos |
| Destaque | `destaque` | Produto mostrado na abertura da vitrine (RF-05) |
| Preço cheio | `precoCentavos` | |
| Preço promocional | `precoPromocionalCentavos` | Sempre menor que o preço cheio |
| Preço efetivo | `precoEfetivo`, `precoDe` | O promocional quando existe, senão o cheio |
| Sob consulta | `sobConsulta`, `temSobConsulta` | Produto sem preço que pode entrar no carrinho (RF-07) |
| Disponível / Indisponível | `disponivel`, `estoque` | Indisponível não entra no carrinho (RF-08) |
| Origem do catálogo / Fonte de catálogo / ERP / Bling | `origem`, `idExterno`, `sincronizadoEm` | Fora da primeira versão: RF-30 a RF-33 |

## Pedido

| Negócio | Código | Evite / nota |
|---|---|---|
| Carrinho | `carrinho:<loja id>` | Vive no navegador (`localStorage`); o servidor só recebe id e quantidade |
| Pedido | `criarPedido`, `POST /api/pedidos` | Salvo antes de o WhatsApp abrir (RF-13), com cópia do nome e do preço de cada item (RF-16) |
| Número do pedido | `numero` | |
| Status do pedido | `STATUS` | Alterado à mão pelo admin (RF-24) |
| Mensagem do pedido | `montarMensagem` | Formato exato em `docs/prototipo/API.md` § Mensagem e link |
| Link do WhatsApp | `linkWhatsApp` | Link `wa.me` para o número do vendedor, com a mensagem pronta |

## Loja e admin

| Negócio | Código | Evite / nota |
|---|---|---|
| Loja | `LOJA`, `PASTA_LOJA`, `validarLoja` | Uma instância por deploy, sem dado compartilhado (RF-40) |
| Vendedor | `whatsapp` | Recebe o pedido no WhatsApp e conclui a venda; não usa o sistema |
| Admin | `SENHA_ADMIN`, `ADMIN` | Único ator que faz login (RF-20) |
| Customização por loja | `PASTAS_WEB`, `atenderEstatico` | `lojas/<loja>/web/<arquivo>` substitui `web/<arquivo>` (RF-42) |
| Tema | `tema.css` | Cores, fonte e raio de cada loja |
| Faixa | `faixa.html` | Bloco de abertura da vitrine |

## Armadilhas

| No código | Significa | Por quê |
|---|---|---|
| `estoque` | Nulo quer dizer estoque não controlado: o produto está disponível | Indisponível é o valor zero (`disponivel`) |
| `atributos` | Lista de nomes na categoria; mapa de nome para valor no produto | A mesma chave tem duas formas |
| `precoCentavos` | Inteiro em centavos: 29990 é R$ 299,90 | RNF-03; vale para todo campo terminado em `Centavos` |
| `totalCentavos` | Soma só dos itens com preço | Item sob consulta não tem valor; `temSobConsulta` avisa que há algum |
| `em_atendimento` | Status que os requisitos escrevem como em atendimento | A API usa o valor sem espaço nem acento (`concluido` também) |
| `loja.js` | Telas do cliente: vitrine, produto, carrinho e confirmação | Loja também nomeia a instância (`LOJA`) e a tela de configuração do admin |
