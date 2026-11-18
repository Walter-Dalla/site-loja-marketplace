# Telas do protótipo

Duas páginas, cada uma com rotas por hash. O visual é provisório: o que se valida aqui é o fluxo. Dados e regras vêm de [API.md](API.md).

| Página | Casca | Script | Rotas |
|---|---|---|---|
| Loja, em `/` | `web/index.html` | `web/loja.js` | `#/`, `#/produto/<id>`, `#/carrinho`, `#/pedido` |
| Admin, em `/admin` | `web/admin.html` | `web/admin.js` | `#/produtos`, `#/produto/novo`, `#/produto/<id>`, `#/categorias`, `#/pedidos`, `#/loja` |

## Regras comuns

- As telas são desenhadas dentro de `#app`. Hash desconhecido cai na primeira rota da página.
- Todo dado que vem da API ou do usuário passa por `esc` antes de entrar no HTML. A única exceção é `faixa.html`, que é arquivo da própria loja.
- Chamadas à API usam `api` de `web/comum.js`. Erro aparece na tela com `avisoHtml('erro', linhasDoErro(erro))`, uma linha por item de `detalhes`.
- Classes de estilo já existem em `web/base.css`, agrupadas por tela. Estilo novo entra nesse arquivo; cor, fonte e raio vêm só das variáveis de `tema.css`.

| O que é guardado | Onde | Formato |
|---|---|---|
| Carrinho | `localStorage`, chave `carrinho:<id da loja>` | `[{ "produtoId": "p1", "quantidade": 2 }]` |
| Último pedido enviado | `sessionStorage`, chave `ultimoPedido` | resposta de `POST /api/pedidos` |
| Token do admin | `sessionStorage`, chave `adminToken` | string |

Valor lido do armazenamento é tratado como dado não confiável: carrinho malformado vale como vazio.

## Loja

Ao abrir, a página busca `GET /api/loja` e preenche `#loja-nome`, `#loja-slogan` e o título da aba. `#carrinho-qtd` mostra a soma das quantidades do carrinho e acompanha toda mudança.

### Vitrine: `#/`

- **Abertura**: sem filtro ativo e na página 1, mostra o conteúdo de `/faixa.html` dentro de `.faixa` e a seção Destaques, com até 4 produtos de `destaque=1`.
- **Busca**: campo de texto enviado pelo formulário (Enter ou botão).
- **Categorias**: um botão "Todos" e um por categoria, com o total de produtos. A categoria ativa fica marcada (`aria-pressed="true"`).
- **Atributos**: com uma categoria escolhida, um `select` por atributo que tenha valores, com a opção "Todos".
- Trocar de categoria limpa os atributos escolhidos. Qualquer mudança de filtro volta à página 1.
- **Lista**: 8 produtos por página, total encontrado, e navegação anterior/próxima quando há mais de uma página.
- **Cartão**: capa (`capa`), nome, preço (`precoHtml`) e a etiqueta "Indisponível" quando `disponivel` é falso. O cartão inteiro leva a `#/produto/<id>`.
- **Sem resultado**: "Nenhum produto encontrado" e um botão que limpa os filtros.

### Produto: `#/produto/<id>`

- Capa, nome, preço, atributos em lista de definição (`.ficha`), descrição.
- Quantidade de 1 a 99 e o botão "Adicionar ao carrinho". Somar ao que já está no carrinho respeita o teto de 99.
- Depois de adicionar: aviso com link para o carrinho.
- Produto indisponível: etiqueta "Indisponível" e botão desabilitado.
- Produto inexistente: mensagem e link para a vitrine.

### Carrinho: `#/carrinho`

- Busca os produtos do carrinho com `GET /api/produtos?ids=…&porPagina=50`, para mostrar nome, preço e disponibilidade atuais.
- **Item**: nome, preço unitário, quantidade editável de 1 a 99, subtotal, botão remover.
- **Item fora de venda** (não veio da API, ou indisponível): fica marcado, não entra no total nem no pedido, e só pode ser removido.
- **Total**: soma dos itens com preço, seguido de "+ itens sob consulta" quando houver.
- **Formulário**: nome, telefone, observação, um aviso curto de que nome e telefone são usados só para atender o pedido (RNF-06), e o botão "Enviar pedido pelo WhatsApp". O que o cliente digitou sobrevive a uma mudança de quantidade.
- **Carrinho vazio**: mensagem e link para a vitrine.

Envio do pedido (RF-13 a RF-15):

1. No próprio clique, abrir uma janela em branco. Aberta depois da resposta, o navegador a bloqueia como pop-up.
2. `POST /api/pedidos` com os itens à venda.
3. Sucesso: guardar a resposta em `ultimoPedido`, esvaziar o carrinho, apontar a janela para `linkWhatsApp` e ir para `#/pedido`. A janela só navega para endereço que começa com `https://wa.me/`.
4. Erro: fechar a janela e mostrar as linhas do erro no carrinho, mantendo itens e formulário.

### Confirmação: `#/pedido`

- Número do pedido, total, a mensagem em `pre.mensagem`, e o botão "Abrir WhatsApp" (link em nova aba), para o caso de a janela não ter aberto ou de o cliente não ter enviado.
- Sem `ultimoPedido` na sessão: mensagem e link para a vitrine.

## Admin

- Sem token: tela de login com o campo de senha, e `#nav` escondido. Senha errada mostra o erro.
- Com token: `#nav` visível, com a classe `atual` no link da rota aberta, e `#loja-nome` com o nome da loja.
- Qualquer resposta 401: descartar o token e voltar ao login. `#sair` faz o mesmo.
- Depois de salvar ou excluir, a tela mostra um aviso de confirmação.

### Produtos: `#/produtos`

Tabela com nome (link para a edição), categoria, preço (ou "Sob consulta"; com promoção, os dois valores), estoque ("—" quando não controlado), ativo, destaque e origem. Botão "Novo produto".

### Produto: `#/produto/novo` e `#/produto/<id>`

- Campos: nome, categoria, atributos, descrição, sob consulta, preço, preço promocional, estoque, URL da imagem, ativo, destaque.
- Os campos de atributo são os da categoria escolhida. Trocar a categoria redesenha esses campos e mantém o valor dos atributos de mesmo nome.
- Marcar "sob consulta" desabilita os dois campos de preço.
- Preço é digitado em reais (`199,90` ou `1.299,00`) e enviado em centavos. Preço que não é número é recusado na própria tela, antes da chamada.
- Estoque vazio significa não controlado (`null`).
- Salvar volta para a lista. Excluir pede confirmação.

### Categorias: `#/categorias`

Uma linha editável por categoria, com nome e atributos separados por vírgula, e os botões Salvar e Excluir. Abaixo, o formulário de nova categoria. A recusa de excluir categoria com produtos (409) aparece como erro.

### Pedidos: `#/pedidos`

- Filtro por status. Lista do mais novo ao mais antigo.
- Cada pedido é um bloco que abre e fecha (`details.bloco`). Fechado: número, data e hora em pt-BR, cliente, total, status. Aberto: telefone, itens com quantidade e subtotal, observação, a mensagem enviada, e um `select` de status que salva ao mudar (RF-24).

### Loja: `#/loja`

Nome, slogan e WhatsApp do vendedor, com a dica "DDI + DDD + número, só dígitos" (RF-25).

## Roteiro de aceite da loja

Com as duas lojas no ar e os dados iniciais.

Na loja de jogos (porta 4101):

1. A vitrine mostra a faixa, 4 destaques e 8 produtos; a página 2 mostra os outros 4.
2. "Consoles" lista 2 produtos; escolhendo Plataforma = PS5, sobra 1.
3. A busca `ragnarok` (sem trema) encontra "God of War Ragnarök".
4. "Elden Ring" aparece como indisponível e não pode ser adicionado.
5. Adicionar 2 "EA Sports FC 26" e 1 "Controle DualSense": o contador marca 3 e continua em 3 depois de recarregar a página.
6. Enviar com o nome vazio mostra o erro e não cria pedido.
7. Enviar com nome e telefone válidos abre o WhatsApp numa aba, leva à confirmação com o número do pedido e o total de R$ 949,70, e deixa o carrinho vazio.

Na loja de impressão 3D (porta 4102):

8. "Bambu Lab X1 Carbon" mostra "Sob consulta".
9. Com ele e 1 "Filamento PLA 1 kg preto" no carrinho, o total é "R$ 119,90 + itens sob consulta", e a mensagem da confirmação traz a linha "sob consulta".
10. O carrinho e os pedidos feitos na porta 4101 não aparecem aqui.

Nas duas lojas:

11. O console do navegador fica sem erros durante todo o roteiro.

## Roteiro de aceite do admin

Em qualquer das lojas:

1. `/admin` abre no login; senha errada mostra o erro; `admin` entra.
2. Criar um produto em uma categoria: os campos de atributo são os dessa categoria, e o produto aparece na vitrine.
3. Editar esse produto e marcar "sob consulta": os campos de preço ficam desabilitados e a vitrine mostra "Sob consulta".
4. Desativar o produto: ele some da vitrine e continua na lista do admin.
5. Preço `abc` é recusado na tela; preço promocional maior que o preço mostra o erro da API.
6. Acrescentar um atributo a uma categoria: o campo aparece no formulário de produto dessa categoria.
7. Excluir uma categoria com produtos mostra o erro; excluir uma categoria vazia funciona.
8. Um pedido feito na loja aparece no topo de Pedidos como "novo"; mudar para "em atendimento" permanece depois de recarregar; o filtro por status funciona.
9. Trocar o WhatsApp em Loja: o próximo pedido gera link com o número novo. Trocar o nome: o topo da loja mostra o nome novo depois de recarregar.
10. Sair volta ao login; recarregar a página com sessão aberta mantém a sessão.
11. O console do navegador fica sem erros durante todo o roteiro.
