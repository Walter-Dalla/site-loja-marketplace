# Protótipo: API falsa com testes de contrato, telas da loja e telas do admin · 2026-11-18 · impl/prototipo · PR on GitHub
Pendências: P-001, P-002, P-003 (todas concluídas). Base: `adocao-wh-perfis` @ 860cefe, por decisão do dono (a `main` não tinha os perfis do harness). Ponta final: ver o PR.
Lanes:
api: DONE · 6 items · 3390eb9
loja: DONE · 3 items · fff9270
admin: DONE · 4 items · 26a6591 (+ 4b7a1fa, QA-admin-01)
Integração (fora das lanes): 4749492 `prototipo-fix` (POST recusado com 422 não gasta id), 857f348 (regra CSS redundante), 0094239 QA-final-01, 8f99fdc QA-final-04.
Decisões do dono (2026-11-18): valor de atributo > 80 = 422; tolerâncias T1–T5 mantidas e afirmadas nos testes; roteiros de tela só em `.impl/`, fora do git; nome e telefone validados só no servidor.

## Errors
- Nenhum conflito de merge (as três lanes entraram limpas; `base.css` e `comum.js` só receberam acréscimos).
- `roteiro-admin.mjs` passo 5 vermelho na primeira execução de prototipo-11: o script fixava `p13` e um POST recusado gastava id. Script corrigido pelo enricher (consulta 01) e servidor corrigido em 4749492, com teste.
- Teste D6 da lane api falhou na primeira execução por compartilhar processo com o teste D2; a lane o moveu para `describe` próprio.
- Ponta final: suíte 36/36, typecheck exit 0, `roteiro-loja.mjs` e `roteiro-admin.mjs` inteiros exit 0, conferência visual de 48 telas (duas lojas, 360 e 1280 px) sem estouro, sem contraste abaixo do mínimo, sem erro inesperado no console.

## Open items
Nenhum item pulado; nenhuma decisão tomada sem o dono.
- CI que rode a suíte e o typecheck (o repo não tem guarda nenhuma) → P-004.
- Regras fixadas no código que `API.md`/`TELAS.md` não escrevem (422 acima de 80 caracteres; id nunca reusado e POST recusado não gasta id; 500 com `detalhes: []`; tolerâncias T1–T5; total "Sob consulta" e acoplamento ao texto da mensagem, QA-loja-01; passo 11 e respostas 4xx; tabela do admin a 360 px, QA-final-03) → P-005.
- Decisões do enricher a confirmar: carrinho guardado inválido vale como vazio; preço do admin só em formato pt-BR; excluir categoria sem `confirm()` (TELAS.md só pede para produto); filtro de pedidos zera ao recarregar → P-005 se o dono quiser escrevê-las.
- Roteiros de tela (`.impl/prototipo/aceite/`) somem na limpeza: o repo fica sem regressão de tela. Promover a `prototipo/teste/telas/` é decisão do dono (P-004, Open questions).

## Consultations
admin prototipo-11 · roteiro-admin.mjs passo 5 espera p13 para o produto criado depois de 4 recusas, mas o servidor gasta um id em todo POST … · adjust. Conferido na ponta 6caaacf: prototipo/server.mjs:319 e :335 chamam novoId antes de validarProduto/validarCategor… · impact item · enricher

## QA
| Id | Type | Severity | Where | Evidence | Fix |
|---|---|---|---|---|---|
| QA-admin-01 | standard | low | prototipo/web/admin.js:164-171 (precoNaLista) | `comum.js` já exporta `precoHtml` (sob consulta, `<s>` cheio + promocional); admin reimplementa a mesma regra de preço e criou `table.produtos s` em base.css só para isso | usar `precoHtml` da `comum.js` (ou aceitar a duplicação por ser protótipo descartável) |
| QA-admin-02 | risk | low | prototipo/web/admin.js:45-56 (carregarLoja) | resposta de `GET /admin/loja` que chega depois de `#sair` ainda executa `mostrarNomeDaLoja(loja.nome)`: título da página fica "Admin · <loja>" na tela de login; só o `.then` ignora a sessão | no `.then`, conferir `lerToken()` antes de `mostrarNomeDaLoja` |
| QA-admin-03 | risk | low | prototipo/web/admin.js:230 (camposDeAtributo) | produto novo sem categoria escolhida mostra "Esta categoria não tem atributos." (texto enganoso antes de escolher) | texto "Escolha a categoria para ver os atributos" quando `categoria` é undefined |
| QA-admin-04 | missing test | low | 401 em chamada que não é login; `#sair`; hash desconhecido -> `#/produtos`; `#/produto/<id inexistente>` | o roteiro de aceite lido nos logs só cobre os passos 1-10 listados (OK nos 4 logs); não vejo prova nos logs de 401 de sessão vencida nem do fallback de hash | passo extra no `roteiro-admin.mjs` (fora do git): reiniciar servidor e recarregar, hash `#/xyz`, `#/produto/pX` |
| QA-api-01 | risk | low | `prototipo/server.mjs:387-392` (`lerCorpo`) | The body is now read to the end with no upper bound (only storage is capped). A 20 MB+ body ties up the process in a prototype; harmless locally, and it is what the plan chose for a deterministic 413. | Accept; mention in the report. Optionally `req.destroy()` after a few MB. |
| QA-api-02 | risk | low | `prototipo/web/comum.js:23-31` | The `try` also covers building the `fetch` arguments, so a `JSON.stringify` failure (circular body) would show as "Sem conexão". The plan said to wrap only the `fetch` call. | Compute `body` before the `try`. |
| QA-final-01 | bug | medium | loja impressao3d, `#/carrinho` a 360 px (regra em `prototipo/web/base.css:195-204`, `.item`) | Com Creality Ender-3 V3 SE + Bambu Lab A1 Mini no carrinho: `li.item` mede 357 px numa trilha `.itens` de 328 px; `scrollWidth` 373 > 360 (rolagem horizontal, borda direita do cartão e subtotal cortados). Esperado (RNF-05, ANALYSIS § 4.2 "conferir a 360 px o item do carrinho"): sem rolagem horizontal. Repro: `node qa/visual.mjs 4118 4119` e `node qa/carrinho360.mjs 4118` na raiz do worktree; foto `.impl/prototipo/qa/visual/impressao3d-360-carrinho-erro.png`. A loja de jogos não estoura (nomes mais curtos) | `.item { grid-template-columns: minmax(0, 1fr) auto; }` em base.css (medido injetando a regra: `scrollWidth` 360, li 328; foto `impressao3d-360-carrinho-com-minmax.png`) |
| QA-final-02 | risk | low | `prototipo/web/index.html`, `prototipo/web/admin.html` (passo 11 dos dois roteiros) | `GET /favicon.ico` → 404 (curl na 4118) e nenhuma das cascas tem `<link rel="icon">`. O chrome-headless-shell não pede favicon, então o passo 11 não acusa nada aqui; um Chrome com janela pede o arquivo, e a linha do 404 pode aparecer no console. Não demonstrado | `<link rel="icon" href="data:,">` no `<head>` das duas cascas (as lanes já tinham essa permissão) |
| QA-final-03 | product judgment | low | admin `#/produtos` a 360 px | Dentro de `.rolagem`, a tabela mostra só Nome e Categoria; Preço, Estoque, Ativo, Destaque e Origem só aparecem rolando para o lado, sem nenhum indício visual (foto `impressao3d-360-admin-produtos.png`). É o que o plano previu (`.rolagem`) e não estoura a página | O dono decide se a lista estreita fica assim ou vira cartões/menos colunas |
| QA-final-04 | bug | medium | loja impressao3d, `#/carrinho` a 360 px, item com promoção (Bambu Lab A1 Mini); `prototipo/web/base.css` `.item` + `precoHtml` em `comum.js` | Efeito da correção do 01: com `minmax(0, 1fr)` a coluna 1 não cresce mais, e o `<s>R$ 2.899,00</s><span class="preco">R$ 2.599,00</span>` (sem ponto de quebra entre os dois; `moeda` usa espaço não separável) vaza da coluna: o conteúdo vai até x=236 e o subtotal começa em x=223, então "R$ 2.599,00" fica sob o subtotal. Esperado: o preço quebra a linha dentro da coluna. Repro: `node qa/sobreposicao.mjs 4118`; foto `.impl/prototipo/qa/visual/impressao3d-360-carrinho-erro.png` (0094239) | `.item .preco-bloco { display: inline-flex; flex-wrap: wrap; align-items: baseline; }` em base.css. Medido injetando a regra: conteúdo até x=207, nada sobrepõe, `scrollWidth` 360; foto `impressao3d-360-carrinho-com-quebra.png` |
| QA-loja-01 | standard | low | prototipo/web/loja.js:273-276,359,478 | TELAS.md § Carrinho: total = "soma dos itens com preço, seguido de + itens sob consulta". Com só itens sob consulta o código mostra "Sob consulta" (textoTotal), não "R$ 0,00 + itens sob consulta"; na confirmação, `soSobConsulta` é inferido por `mensagem.includes('*Total: sob consulta*')`, acoplado ao texto da mensagem | Confirmar com o dono o texto do total só-sob-consulta; se mantido, registrar em TELAS.md; evitar depender do texto da mensagem |
| QA-loja-02 | risk | low | prototipo/web/loja.js:396,444 | `gravarCarrinho` no handler `input` da quantidade e `sessionStorage.setItem('ultimoPedido')` no envio não têm try/catch (cota cheia/storage bloqueado): no envio o pedido já foi criado e o botão fica desabilitado sem aviso (a tela do produto já trata o erro) | Envolver em try/catch como em telaProduto e seguir para #/pedido |
| QA-loja-03 | risk | low | prototipo/web/loja.js:420-449 | Envio sem proteção contra `hashchange` no meio da resposta: se o cliente sair do carrinho durante o POST, o sucesso ainda força `location.hash = '#/pedido'` (comportamento aceitável, só registrado) | Opcional: ignorar |
Corrigidos: QA-admin-01 (4b7a1fa; roteiro do admin inteiro verde), QA-final-01 (0094239; retestado pelo QA final, 48 telas), QA-final-04 (8f99fdc; medido com `qa/sobreposicao.mjs`: 360 px, nada sobrepõe; roteiro da loja verde).
Registrados, sem código (risco não demonstrado, decisão de produto ou baixo): QA-api-01, QA-api-02, QA-loja-01..03, QA-admin-02..04, QA-final-02 (favicon: `<link rel="icon" href="data:,">` resolveria), QA-final-03.

## Problems found
- Nenhuma CI nem pre-commit no repositório (→ P-004).
- A checagem `typecheck` do perfil é só sintaxe (`node --check`): um nome importado errado de `comum.js` passaria.

## Cost
| Agent | Model | Requests | Input | Cache write | Cache read | Output | Share |
|---|---|---|---|---|---|---|---|
| wh:impl-enrich · Enrich analyze prototipo | claude-fable-5-2 | 40 | 88 | 234788 | 6138740 | 134160 | 28% |
| orchestrator (main session) | claude-opus-5-5 | 73 | 150 | 122724 | 9515771 | 32386 | 22% |
| wh:impl-dev · Lane api (W1) | claude-opus-5-5 | 44 | 90 | 116286 | 3539191 | 41526 | 13% |
| wh:impl-dev · Lane admin (W2) | claude-opus-5-5 | 43 | 92 | 107204 | 3627790 | 38866 | 12% |
| wh:impl-qa · Final QA impl/prototipo | claude-opus-5-5 | 52 | 106 | 106637 | 3853583 | 31439 | 11% |
| wh:impl-dev · Lane loja (W2) | claude-opus-5-5 | 36 | 74 | 95049 | 2688708 | 32300 | 10% |
| wh:impl-qa · Code QA lane admin | claude-sonnet-5-5 | 6 | 12 | 40833 | 196769 | 6357 | 2% |
| wh:impl-qa · Code QA lane api | claude-sonnet-5-5 | 5 | 10 | 53040 | 139362 | 4041 | 2% |
| wh:impl-qa · Code QA lane loja | claude-sonnet-5-5 | 6 | 12 | 43247 | 157175 | 4210 | 1% |
| Total | | 305 | 634 | 919808 | 29857089 | 325285 | 100% |

## Consolidated retro
Candidatos iguais em palavras diferentes foram unidos; o detalhe de cada um está em `retro/2026-11-18-*-prototipo-*.md` (local ao clone).
| # | Severity | Category | Evidence (lanes) | Proposal | Who applies |
|---|---|---|---|---|---|
| 1 | high | Automatic check | orchestrator, api, loja: nenhuma CI nem pre-commit; suíte e typecheck só rodam quando um agente lembra | Job do GitHub Actions com `typecheck` e `suite` do perfil (Node 22, sem dependências) → P-004 | owner (repo) |
| 2 | high | Automatic check | enricher, admin, orchestrator: roteiro de tela escrito antes da tela fixou `p13`, que o contrato não fixa; custou a consulta 01 | Prompt do enricher: aceite só afirma valor que o doc fixa ou que a mesma sequência de chamadas mediu; registro criado é achado por campo estável | owner (plugin) |
| 3 | medium | Automatic check | admin: a suíte não cobria "422 em POST não gasta id" | Teste acrescentado em 4749492 — applied | repo |
| 4 | medium | Information access | enricher, loja, orchestrator, qa-final: sem harness de tela; o driver CDP (`aceite/lib.mjs`) some com `.impl/`; o QA final escreveu outro | Dono decide promover `aceite/` a `prototipo/teste/telas/` com chave `screens` no perfil; ou o plugin traz o driver | owner |
| 5 | medium | Acceptance coverage | qa-final: roteiros só a 390 px e só medindo largura; QA-final-01 achado por script avulso e QA-final-04 escondido pela métrica de largura | `aceite/lib.mjs`: emular 360 px, falhar com `scrollWidth > clientWidth` e com sobreposição entre células vizinhas; ler a foto antes de sugerir correção | plugin (prompt do QA) / repo se o roteiro for promovido |
| 6 | medium | Steering doc | orchestrator: base em outra branch que não `main`; `lane_prompt.sh final` imprimiu `Diff base: main` | `lane_prompt.sh` lê o MAIN da execução; SKILL.md fase 1 documenta a base alternativa | owner (plugin) |
| 7 | medium | Steering doc | enricher: prompt diz que pendências vivem no worktree de integração; `PENDING.md` diz que são locais ao clone | Alinhar o prompt com `PENDING.md`; `LANES.md` §1: a lane copia o que precisa da pendência | owner (plugin) |
| 8 | medium | Tool economy | enricher, qa-final: `cat -n` reescrito pelo RTK e recusado; `Write` em `.impl/…/ANALYSIS.md` recusado; `kill` do próprio serviço recusado uma vez | `ENVIRONMENT.md`: heredoc para `.md` em `.impl/`, `rtk read -n`, registrar o pid ao subir o serviço | owner (plugin) |
| 9 | low | Steering doc | api: § Union files diz só acréscimo, mas a lane api editou `comum.js` em `api()` | Perfil § Union files: uma lane pode ter um deles para uma edição nomeada | owner (perfil protegido) |
| 10 | low | Code standard | api: teste de ids falhou por dividir processo com outro teste que cria produtos | `docs/prototipo/README.md` § testes: teste que afirma id, contagem ou número gerado tem `describe` próprio | owner (docs) |
| 11 | low | Tool economy | api: `profile_run.sh suite` imprime 30 linhas de TAP | Perfil, chave `suite`: `--test-reporter=dot` | owner (perfil protegido) |
| 12 | low | Automatic check | enricher: `acceptance.py` trata todo `## ` de `PLAN.md` como item; `scope.sh` lê toda crase em `Owns:` | Só títulos `<slug>-N`; exemplo de `LANES.md` sem crases na nota "edit:" | owner (plugin) |
| 13 | low | Steering doc | enricher, loja: passo 11 de `TELAS.md` conflita com as respostas 4xx provocadas; confirmação deduz "só sob consulta" do texto da mensagem | → P-005 | owner (docs) |
| 14 | low | Tool economy | orchestrator: `intake.sh` leu "todas as pendencias" como pedido livre | Tratar "todas"/"all" como sem argumento | owner (plugin) |
| 15 | low | Environment | enricher: serviço descartável preso na porta 4110 por pid perdido; qa-final: headless não pede `/favicon.ico` | `ENVIRONMENT.md`: subir com `run_in_background`; lista do QA visual: favicon por `curl` + grep de `<link rel="icon">` | owner (plugin) |
