# Contrato da API do protótipo

Base `/api`, JSON em UTF-8. Todo valor monetário é um inteiro em centavos (RNF-03).

## Convenções

- **Erro**: `{ "erro": "<mensagem>", "detalhes": ["<linha>", …] }`. `detalhes` traz uma linha por problema e pode vir vazio.
- **Sucesso sem corpo**: 204.
- **Admin**: toda rota `/api/admin/*`, menos o login, exige `Authorization: Bearer <token>`.

| Status | Quando |
|---|---|
| 400 | JSON malformado, corpo que não é um objeto JSON, URL ou caminho inválido |
| 401 | rota de admin sem token válido; senha errada no login |
| 404 | rota inexistente; recurso não encontrado |
| 405 | o caminho existe, mas não para esse método |
| 409 | excluir categoria que ainda tem produtos |
| 413 | corpo maior que 100 kB |
| 422 | validação; nada é gravado |

## Modelo

### Produto (visão do admin)

| Campo | Tipo | Regra |
|---|---|---|
| `id` | string | gerado pelo servidor |
| `nome` | string | 2 a 120 caracteres |
| `descricao` | string | até 2000 caracteres |
| `categoriaId` | string | categoria existente |
| `sobConsulta` | boolean | `true`: os dois preços ficam `null` |
| `precoCentavos` | inteiro ≥ 0 ou `null` | obrigatório quando não é sob consulta |
| `precoPromocionalCentavos` | inteiro ≥ 0 ou `null` | menor que `precoCentavos` |
| `estoque` | inteiro ≥ 0 ou `null` | `null` = estoque não controlado |
| `ativo` | boolean | padrão `true`; inativo some das rotas públicas |
| `destaque` | boolean | padrão `false` |
| `imagemUrl` | string | vazio, ou URL `http(s)://` de até 500 caracteres |
| `atributos` | objeto nome → valor | só os nomes que a categoria define; valor de até 80 caracteres; valor vazio é descartado |
| `origem` | `"manual"` ou `"erp"` | sempre `"manual"` no protótipo; o admin não altera (RF-30) |
| `idExterno`, `sincronizadoEm` | `null` | reservados para a integração com ERP (RF-30) |

Textos chegam com espaços das pontas removidos.

### Produto (visão pública)

`id`, `nome`, `descricao`, `categoriaId`, `precoCentavos`, `precoPromocionalCentavos`, `sobConsulta`, `disponivel`, `destaque`, `imagemUrl`, `atributos`.

- `disponivel` é `true` quando `estoque` é `null` ou maior que zero. A quantidade em estoque não é exposta.
- Só produtos ativos aparecem.

### Categoria

- Admin: `{ id, nome, atributos: ["Plataforma", …] }`. `nome` de 2 a 60 caracteres. Até 12 atributos, sem repetição, cada um com 1 a 40 caracteres entre letras, números e espaços.
- Pública: `{ id, nome, total, atributos: [{ nome, valores: […] }] }`. `total` conta os produtos ativos da categoria. `valores` lista, em ordem alfabética pt-BR, os valores distintos que os produtos ativos da categoria têm para aquele atributo.

### Pedido

```json
{
  "numero": 1001,
  "criadoEm": "2026-11-18T14:03:00.000Z",
  "status": "novo",
  "cliente": { "nome": "Ana Souza", "telefone": "11987654321" },
  "observacao": "",
  "itens": [
    { "produtoId": "p1", "nome": "EA Sports FC 26", "quantidade": 2, "precoUnitarioCentavos": 24990, "subtotalCentavos": 49980 }
  ],
  "totalCentavos": 49980,
  "temSobConsulta": false,
  "mensagem": "…",
  "linkWhatsApp": "https://wa.me/…"
}
```

- `status`: `novo`, `em_atendimento`, `concluido` ou `cancelado`.
- `numero`: sequencial por processo; o primeiro é 1001.
- Cada item guarda cópia do nome e do preço do momento (RF-16). Item sob consulta tem `precoUnitarioCentavos` e `subtotalCentavos` `null`.

### Loja

`{ id, nome, slogan, whatsapp }`. `nome` de 2 a 60 caracteres, `slogan` até 120, `whatsapp` com 10 a 15 dígitos (o que não for dígito é removido). `id` é o nome da pasta da loja e não muda.

## Rotas públicas

| Método e caminho | Resposta |
|---|---|
| `GET /api/loja` | `{ id, nome, slogan }`, sem `whatsapp` |
| `GET /api/categorias` | lista de categorias públicas |
| `GET /api/produtos` | `{ itens, total, pagina, porPagina }`, com `itens` na visão pública |
| `GET /api/produtos/:id` | produto na visão pública; 404 se não existe ou está inativo |
| `POST /api/pedidos` | 201 com `{ numero, totalCentavos, temSobConsulta, mensagem, linkWhatsApp }` |

### Parâmetros de `GET /api/produtos`

Todos opcionais e combináveis.

| Parâmetro | Efeito |
|---|---|
| `categoria` | id da categoria |
| `busca` | texto procurado em nome e descrição, sem diferenciar maiúsculas nem acentos |
| `destaque=1` | só produtos em destaque |
| `a.<Atributo>=<valor>` | valor exato do atributo; um parâmetro por atributo |
| `ids=p1,p2` | só os ids listados |
| `pagina` | a partir de 1; padrão 1 |
| `porPagina` | de 1 a 50; padrão 12 |

`total` conta o resultado do filtro antes da paginação.

### `POST /api/pedidos`

Corpo:

```json
{
  "cliente": { "nome": "Ana Souza", "telefone": "(11) 98765-4321" },
  "observacao": "Retiro na loja no sábado.",
  "itens": [{ "produtoId": "p1", "quantidade": 2 }]
}
```

Regras, todas resultando em 422 sem gravar o pedido:

- `cliente.nome`: 2 a 80 caracteres.
- `cliente.telefone`: 10 ou 11 dígitos depois de remover o que não é dígito.
- `observacao`: opcional, até 500 caracteres.
- `itens`: de 1 a 50. `quantidade` inteira de 1 a 99. O mesmo produto repetido soma as quantidades, e a soma também respeita o limite de 99.
- Cada produto precisa existir, estar ativo e disponível. Com estoque controlado, a quantidade não passa do estoque.

O preço vem sempre do catálogo do servidor: promocional se houver, senão o cheio, `null` se for sob consulta. Qualquer preço enviado pelo navegador é ignorado (RF-12). O pedido não baixa estoque.

A resposta não devolve os dados do cliente. O pedido completo só aparece nas rotas de admin (RNF-07).

### Mensagem e link

`linkWhatsApp` é `https://wa.me/<whatsapp da loja>?text=<mensagem em encodeURIComponent>`, com o número que a loja tinha quando o pedido foi criado.

`mensagem`, com quebras `\n`:

```text
*Pedido #1001 - Loja de Jogos*
Cliente: Ana Souza
Telefone: 11987654321

2x EA Sports FC 26 - R$ 499,80
1x Controle DualSense - R$ 449,90

*Total: R$ 949,70*

Obs.: Retiro na loja no sábado.
```

- Uma linha por item, com o subtotal. Item sob consulta: `1x Bambu Lab X1 Carbon - sob consulta`.
- Com itens sob consulta e itens com preço: `*Total: R$ 119,90* + itens sob consulta`.
- Só itens sob consulta: `*Total: sob consulta*`.
- O bloco `Obs.:` e a linha em branco antes dele só existem quando há observação.
- Valores no formato pt-BR, com espaço comum entre `R$` e o número.

## Rotas de admin

| Método e caminho | Corpo | Resposta |
|---|---|---|
| `POST /api/admin/login` | `{ senha }` | `{ token }`; 401 com senha errada |
| `GET /api/admin/produtos` | | todos os produtos, inclusive inativos |
| `POST /api/admin/produtos` | produto | 201 com o produto criado |
| `PUT /api/admin/produtos/:id` | produto | produto atualizado |
| `DELETE /api/admin/produtos/:id` | | 204 |
| `GET /api/admin/categorias` | | categorias na visão do admin |
| `POST /api/admin/categorias` | `{ nome, atributos }` | 201 com a categoria criada |
| `PUT /api/admin/categorias/:id` | `{ nome, atributos }` | categoria atualizada |
| `DELETE /api/admin/categorias/:id` | | 204; 409 se ainda tem produtos |
| `GET /api/admin/pedidos` | | pedidos completos, do mais novo ao mais antigo; `?status=` filtra |
| `PATCH /api/admin/pedidos/:numero` | `{ status }` | pedido atualizado; 422 com status inválido |
| `GET /api/admin/loja` | | loja completa |
| `PUT /api/admin/loja` | `{ nome, slogan, whatsapp }` | loja atualizada |

- O corpo de produto leva os campos editáveis do modelo: `nome`, `descricao`, `categoriaId`, `sobConsulta`, `precoCentavos`, `precoPromocionalCentavos`, `estoque`, `ativo`, `destaque`, `imagemUrl`, `atributos`. `PUT` substitui todos eles.
- Atributo retirado de uma categoria sai também dos produtos dela.
- Recurso inexistente em `PUT`, `PATCH` ou `DELETE`: 404.
