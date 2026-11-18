# Requisitos

Levantamento inicial (2026-11-18). Fonte: descrição e respostas do dono do projeto. Linhas marcadas **[suposição]** são padrões que eu assumi e ainda não foram confirmados; a lista completa está em [Pontos em aberto](#pontos-em-aberto).

## 1. Visão

Site de vendas em que o cliente monta um carrinho e o pedido é enviado ao vendedor pelo WhatsApp, onde a venda é concluída. O catálogo é cadastrado pelo admin e, mais adiante, também poderá vir de um ERP (Bling como primeiro).

O mesmo software atende duas lojas, cada uma com deploy próprio:

| Loja | Vende |
|---|---|
| Jogos | jogos de videogame |
| Impressão 3D | máquinas de impressão 3D |

## 2. Fases

1. Requisitos (este documento).
2. Protótipo: telas navegáveis consumindo uma API mínima falsa (`prototipo/`, especificado em [prototipo/README.md](prototipo/README.md)). Descartável: valida fluxo e contrato, não define stack nem visual.
3. Arquitetura: feita pelo dono do projeto.
4. Backend completo.
5. Visual (front definitivo).

## 3. Decisões já tomadas

| Tema | Decisão |
|---|---|
| Envio do pedido | O site salva o pedido, monta a mensagem e abre o WhatsApp do cliente (link `wa.me`) com o texto pronto para o número do vendedor. Sem API oficial do WhatsApp. |
| ERP | Fora da primeira versão. O catálogo nasce preparado para receber uma origem externa. |
| Cliente | Sem conta. Informa nome e telefone ao fechar; o carrinho fica no navegador. |
| Pagamento | Fora do site por enquanto; combinado no WhatsApp. |
| Lojas | Um deploy por loja. Front com a mesma base e pastas de customização por loja. |
| Ordem de construção | Backend inteiro primeiro, visual depois. |

## 4. Atores

- **Cliente**: navega, monta o carrinho e envia o pedido. Não faz login.
- **Admin**: cadastra catálogo, acompanha pedidos e configura a loja. Faz login.
- **Vendedor**: recebe o pedido no WhatsApp e conclui a venda. Na primeira versão não usa o sistema **[suposição]**.

## 5. Requisitos funcionais

### Catálogo (vitrine)

- **RF-01** Listar produtos ativos, com paginação.
- **RF-02** Filtrar por categoria e pelos atributos da categoria (ex.: Plataforma, Tecnologia).
- **RF-03** Buscar por texto no nome e na descrição.
- **RF-04** Exibir a página do produto: nome, descrição, imagens, preço, atributos e disponibilidade.
- **RF-05** Destacar produtos na página inicial.
- **RF-06** Produto com preço promocional mostra o preço cheio riscado **[suposição]**.
- **RF-07** Produto "sob consulta" não mostra preço, mas pode entrar no carrinho **[suposição]**.
- **RF-08** Produto sem estoque aparece como indisponível e não entra no carrinho **[suposição]**.

### Carrinho e pedido

- **RF-10** Adicionar, alterar quantidade e remover itens; o carrinho persiste no navegador.
- **RF-11** Fechar o pedido informando nome e telefone (obrigatórios) e observação (opcional).
- **RF-12** O backend recalcula preços e disponibilidade ao fechar; o valor enviado pelo navegador nunca é usado.
- **RF-13** O pedido é salvo antes de o WhatsApp abrir, com número, data, itens, preços do momento, total e dados do cliente.
- **RF-14** O backend monta a mensagem (número do pedido, cliente, itens, quantidades, preços, total, observação) e devolve o link `wa.me` para o número do vendedor da loja.
- **RF-15** A tela de confirmação mostra o número do pedido e um botão para reabrir o WhatsApp, caso o cliente não tenha enviado.
- **RF-16** O pedido guarda cópia do nome e do preço de cada item: alterar o produto depois não altera pedidos antigos.

### Admin

- **RF-20** Login de admin.
- **RF-21** Criar, editar, ativar/desativar e excluir produtos.
- **RF-22** Criar, editar e excluir categorias; cada categoria define a lista de atributos dos seus produtos.
- **RF-23** Listar pedidos com filtro por status e ver o detalhe de cada um.
- **RF-24** Alterar o status do pedido: `novo` → `em atendimento` → `concluído` ou `cancelado` **[suposição]**.
- **RF-25** Configurar a loja: nome, número de WhatsApp do vendedor.
- **RF-26** Enviar imagens de produto.

### Origem do catálogo (preparação para ERP)

- **RF-30** Todo produto registra a origem (`manual` ou `erp`), o identificador externo e a data da última sincronização.
- **RF-31** A integração com ERP é um módulo plugável atrás de uma interface única de "fonte de catálogo"; Bling é a primeira implementação prevista, não a única.
- **RF-32** Produtos manuais e importados convivem no mesmo catálogo.
- **RF-33** Em produto importado, os campos que vêm do ERP (nome, preço, estoque) ficam somente leitura no admin; campos próprios do site (destaque, descrição complementar, ordem das imagens) continuam editáveis **[suposição]**.

### Multi-loja

- **RF-40** Cada loja é uma instância independente: banco, domínio, configuração e admin próprios. Nenhum dado é compartilhado entre lojas.
- **RF-41** O mesmo código serve as duas lojas; a loja é escolhida por configuração no deploy.
- **RF-42** O front tem uma base comum e uma pasta de customização por loja (tema, logo, textos, e substituição de partes da base quando necessário).
- **RF-43** Diferenças de catálogo entre lojas são resolvidas por dados (categorias e atributos), não por código específico de loja.

Atributos esperados por loja **[suposição]**:

| Loja | Atributos |
|---|---|
| Jogos | Plataforma, Condição (novo/usado), Mídia (física/digital), Gênero |
| Impressão 3D | Tecnologia (FDM/resina), Volume de impressão, Marca, Voltagem |

## 6. Requisitos não funcionais

- **RNF-01** Modular: catálogo, pedidos, notificação (WhatsApp), fonte de catálogo (ERP) e admin são módulos com fronteiras claras; trocar o canal de envio ou acrescentar um ERP não mexe nos demais.
- **RNF-02** API primeiro: o backend expõe tudo por API e é utilizável sem o front definitivo.
- **RNF-03** Valores monetários em centavos (inteiros), moeda BRL, idioma pt-BR.
- **RNF-04** Páginas de produto indexáveis por buscadores (pesa na escolha de renderização do front).
- **RNF-05** Uso principal em celular: o fluxo termina no WhatsApp.
- **RNF-06** LGPD: nome e telefone do cliente são dados pessoais; exige aviso no fechamento, acesso restrito ao admin e prazo de retenção definido.
- **RNF-07** Rotas de admin exigem autenticação; pedidos não são consultáveis publicamente por número.
- **RNF-08** Deploy automatizado e repetível por loja.

## 7. Fora do escopo da primeira versão

Pagamento online, cálculo de frete, conta de cliente, integração com ERP, emissão de nota fiscal, cupons, avaliações de produto, envio automático pelo WhatsApp Business.

## Pontos em aberto

Padrões que assumi para o protótipo. Cada um muda requisito se a resposta for outra.

| # | Ponto | Padrão assumido |
|---|---|---|
| 1 | Frete e entrega | O site não calcula nem pergunta; combinado no WhatsApp. |
| 2 | Estoque | Quantidade opcional por produto, ajustada pelo admin. O pedido não baixa estoque, porque a venda só se confirma no WhatsApp. |
| 3 | Preço "sob consulta" | Existe, pensando nas máquinas 3D. |
| 4 | Variações de produto | Não há; o mesmo jogo em duas plataformas são dois produtos. |
| 5 | Vendedores | Um número de WhatsApp por loja. |
| 6 | Usuários do admin | Um único perfil, sem níveis de permissão. |
| 7 | Status do pedido | Alterado à mão pelo admin; o site não sabe se o cliente enviou a mensagem. |
| 8 | Jogos usados e mídia digital | Tratados como atributos; sem regra própria (chave digital, avaliação de usado). |
| 9 | Peças, filamentos e acessórios na loja 3D | São produtos comuns em outras categorias. |
| 10 | Sincronização com ERP, quando vier | Só importar catálogo, ou também devolver o pedido ao ERP: a decidir. |
