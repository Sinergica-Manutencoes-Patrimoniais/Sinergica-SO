# Research — E06-S01

Fonte principal: leitura do produto irmão TriviAtende (`modules/anuncio/`,
`surfaces/analises/RelatorioDeAnuncios.tsx`, Edge Functions `anuncio-*`, migrations do schema
`anuncio`), em produção. Repositório de referência, somente leitura.

## D1 — Grão da métrica: anúncio × dia

**Decisão**: `primary key (anuncio_id, dia)`.
**Porquê**: é a chave natural que a própria Meta devolve com `level=ad&time_increment=1`. Torna o
upsert idempotente sem inventar `request_id`, e qualquer recorte (dia, semana, mês, campanha,
conjunto) é derivável por soma. O produto irmão usa exatamente isto
(`anuncio.numeros_diarios` com `primary key (anuncio_id, dia)`).
**Alternativas**: guardar o agregado por período (impossível reprocessar sem apagar); guardar o
JSON bruto da Meta (empurra o problema de formato para dentro da consulta).

## D2 — Janela de reprocessamento, não "sincronizar o novo"

**Decisão**: toda execução reprocessa os últimos N dias (padrão 7), com upsert.
**Porquê**: a Meta revisa números retroativamente — atribuição tardia, remoção de cliques
fraudulentos. Sincronizar só "ontem" produz um relatório que diverge do Gerenciador de Anúncios, e
a partir daí ninguém confia na tela. O produto irmão reprocessa 3 dias a cada rodada e 28
periodicamente; aqui, com disparo sob demanda em vez de rodada de 15 s, 7 dias cobre o mesmo risco
em uma só configuração.
**Alternativas**: cursor incremental puro (rápido e errado); reprocessar tudo sempre (caro e
desnecessário).

## D3 — `null` ≠ `0` em todo indicador derivado

**Decisão**: `custo(gasto, qtd)` exige `gasto > 0 && qtd > 0`, senão `null`; `dividir(num, den)`
exige `den > 0`, senão `null`. Campo `temNumeros` separado de `gasto === 0`.
**Porquê**: "custo por lead R$ 0,00" num anúncio que gastou e não gerou lead é uma mentira que
leva a decidir errado. `—` é informação; `0` é afirmação.
**Alternativas**: exibir `0` (descartado); exibir `Infinity` (descartado).

## D4 — Alcance não é somável, mas a coluna é

**Decisão**: guardar `alcance` diário; ao agregar, exibir a soma **rotulada** como
"Alcance (soma diária)" com explicação ao lado.
**Porquê**: alcance é gente distinta; somar dias conta a mesma pessoa de novo. O produto irmão
resolve guardando o alcance por janela fixa (7/30/90) lido direto da Meta e exibindo `—` fora
dessas janelas. Isso exige um segundo endpoint e um segundo modelo de tabela — fora da proporção
desta primeira entrega. Rotular a soma é honesto e custa uma linha de texto.
**Consequência registrada**: AC-2 cobra igualdade entre níveis só para gasto, impressões, cliques
e leads. Alcance está deliberadamente fora dessa checagem.
**Alternativa futura**: tabela `alcance_do_periodo(nivel, objeto_id, janela, anterior)` — se e
quando alguém pedir frequência.

## D5 — Agregação no domínio TypeScript, não em SQL

**Decisão**: a RPC devolve uma linha por anúncio no período, com a hierarquia resolvida; a árvore
campanha → conjunto → anúncio e todos os derivados são montados em `domain/indicadores.ts`.
**Porquê**: é onde a regra fica testável por `vitest` em milissegundos, e é literalmente o que se
está portando do produto irmão. SQL faria a mesma soma, mas a prova de AC-2/AC-5 viraria pgTAP
caro e indireto.
**Alternativas**: tudo em SQL (regra fora de teste barato); tudo no SQL + views materializadas
(complexidade sem demanda).

## D6 — Travessia Marketing ↔ Comercial em uma função só

**Decisão**: `marketing.fn_receita_por_campanha`, `security definer`, exigindo os dois claims.
**Porquê**: uma view com `security_invoker` falharia para quem só tem `marketing`; uma view
`security definer` vazaria `comercial.*`. A RPC é o único ponto de encontro, auditável de uma vez.
Detalhado no ADR-1699 §2.
**Alternativas**: o front juntar os dois lados (exigiria `features/marketing` importar
`features/comercial` — proibido); replicar dado do Comercial no Marketing (duas verdades).

## D7 — Fixture em vez de esperar a credencial

**Decisão**: `MetaAdsPort` com `MetaAdsHttp` e `MetaAdsFixture`; a escolha é a presença do segredo
no cofre, e a origem viaja em toda resposta e aparece na tela.
**Porquê**: a Meta não está conectada. Sem fixture, nada é exercitado e o gate verde seria falso.
Com fixture, schema, RLS, agregação, atribuição e tela são provados hoje, e a troca depois é de
credencial, não de código.
**Alternativas**: mock só nos testes e função que falha em produção (a tela nasceria quebrada);
adiar a story inteira (perde a prova do modelo).

## D8 — A porta não tem método de escrita

**Decisão**: `MetaAdsPort` declara `hierarquia` e `numerosDiarios`. Nada mais.
**Porquê**: "fora de escopo" é vinculante. Um método de escrita não usado é um convite a ser
usado; o escopo do token pedido (`ads_read`) torna a decisão também operacional, não só de código.
