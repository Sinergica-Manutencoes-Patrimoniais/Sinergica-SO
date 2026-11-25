---
name: "docs-adr-1699-marketing-indicadores-meta-atribuicao-md"
description: "Documento Sinérgica SO: ADR-1699 — Marketing como bounded context próprio: indicadores da Meta e atribuição anúncio → lead → proposta → contrato (E06-S01)"
alwaysApply: false
---

# ADR-1699 — Marketing: indicadores da Meta e atribuição até a venda (E06-S01)

**Status:** aceita · **Data:** 2026-11-25 · **Story:** E06-S01 · **Tier:** arquitetural (bounded
context novo + integração externa nova)

## Contexto

O módulo Marketing existe hoje só como casca: `apps/web/src/features/marketing/` tem um
`.gitkeep`, o item aparece em `app/modulos.ts` e cai no placeholder "Em construção" de
`HomePage.tsx`. Decisão do Lucas em 25/11/2026: *"na parte de marketing irão aparecer os
indicadores das campanhas da meta"*, com o escopo escolhido sendo **indicadores + rastreio
anúncio → lead → proposta → contrato**.

Existe um produto irmão da casa (TriviAtende/rosefish) que já faz isto em produção, com modelo de
domínio maduro (conta de anúncios → campanha → conjunto → anúncio → métrica diária; link
rastreado; entrada por anúncio). O porte é **híbrido**: a lógica, as métricas e a UX vêm de lá; os
dados, o schema e a arquitetura são daqui. A estrutura `modules/` + `surfaces/` do rosefish **não**
vem junto.

Restrição dura no momento da entrega: **a Meta não está conectada.** Não há App ID, nem token de
sistema, nem `act_<id>` cadastrado. Construir contra a API real agora significaria código não
exercitado e um gate verde falso.

## Decisão

### 1. Schema próprio `marketing`, não tabela em `public` nem carona no `comercial`

O schema `marketing` já nasceu declarado em `0001_E00-S00_schemas_dominio.sql` ("Marketing:
calendário, conteúdo") e nunca ganhou tabela. É ele que recebe as sete tabelas desta story:
`contas_anuncio`, `campanhas`, `conjuntos`, `anuncios`, `metricas_anuncio_dia`, `links_rastreados`,
`entradas_anuncio`.

Motivos:
- **Permissão por módulo já é por schema de domínio.** A policy padrão do projeto lê
  `auth.jwt() -> 'user_modulos' ->> '<modulo>'`; com schema próprio, `marketing` é o claim, e quem
  não tem o módulo não enxerga nada — sem precisar de coluna discriminadora em tabela comum.
- **Dado de plataforma externa é descartável e re-sincronizável.** Misturar isso com
  `comercial.*` (dado de negócio, escrito por humano) é confundir uma cópia com um original.
- Todas as tabelas nascem com `enable row level security` **e** `force row level security`, GRANT
  explícito (sem GRANT a RLS nunca é avaliada — ver `db/rls.template.sql`) e teste pgTAP com os
  dois lados, permitido e negado.

Nomes de tabela sem prefixo `sso_`: é uma **fundação** de contexto novo, mesmo caso de
`0175_E03-S01_fundacao_comercial.sql` (`comercial.oportunidades`, `comercial.etapas_funil`). O
prefixo `sso_` no projeto marca tabela acrescentada a um domínio já existente, não a fundação dele.

### 2. Modelo de atribuição: o Marketing **referencia** o Comercial, nunca o reimplementa

O rastreio pedido é anúncio → lead → oportunidade → proposta → contrato. A oportunidade, a
proposta e o contrato são do Comercial (`comercial.oportunidades`, `comercial.propostas`,
`comercial.contratos`, E03-S01/S04/S07) e **continuam sendo**. O Marketing não cria funil, não cria
proposta, não calcula ciclo de venda.

A decisão em três níveis:

- **No banco, a FK atravessa o schema, e isso é correto.** `marketing.entradas_anuncio` guarda
  `oportunidade_id uuid references comercial.oportunidades(id)`, opcional. Há precedente direto:
  `comercial.oportunidades` já referencia `atendimento.conversas` e `relacionamento.contatos`. FK é
  integridade referencial, não acoplamento de código — ela impede exatamente o que não queremos
  (um vínculo apontando para oportunidade que não existe).
- **A receita por campanha sai de uma RPC do Marketing, não de uma view aberta.**
  `marketing.fn_receita_por_campanha(p_de, p_ate)` é `security definer`, varre
  `entradas_anuncio → oportunidades → contratos` e exige **as duas** permissões no JWT do chamador
  (`marketing` e `comercial`, leitura ou escrita). Uma view com `security_invoker` falharia para
  quem só tem `marketing`; uma view `security definer` vazaria `comercial.*` para quem não tem o
  módulo. A RPC é o único ponto onde os dois contextos se encontram, e ela é auditável em um lugar
  só.
- **No front, fronteira dura.** `features/marketing/` **não importa** `features/comercial/`. A
  tela de receita por campanha consome a RPC acima pelo adapter do próprio Marketing. Se um dia
  precisar de componente compartilhado, ele vai para `packages/` — regra do `CLAUDE.md`.

O vínculo é criado **de fora para dentro**: quem sabe que um lead veio do anúncio é o clique
rastreado (`links_rastreados`), que produz uma `entradas_anuncio`; o casamento com a oportunidade é
um campo preenchido depois, nunca uma inferência silenciosa do Marketing sobre o funil.

### 3. Sincronização por Edge Function, idempotente, com janela de reprocessamento

`marketing-sincronizar-meta` (Deno, `service_role`) é o único caminho de escrita das tabelas de
plataforma. O client **nunca** fala com a Meta e **nunca** tem `service_role`.

- **Chave natural de idempotência:** `metricas_anuncio_dia` tem `unique (anuncio_id, dia)` e a
  gravação é `insert ... on conflict do update`. Reprocessar o mesmo dia duas vezes produz o mesmo
  estado. O mesmo vale para `campanhas`/`conjuntos`/`anuncios` por `meta_id`.
- **Janela de reprocessamento:** a sincronização sempre reprocessa os últimos *N* dias (padrão 7,
  parametrizável), porque a Meta revisa números retroativamente (atribuição tardia, fraude
  removida). Sincronizar só "ontem" produz um relatório que diverge do Gerenciador de Anúncios e
  ninguém confia mais na tela. Toda execução é registrada em `marketing.sincronizacoes` com
  janela, contagem e resultado — sucesso e falha.

### 4. Credencial no Vault, com nome fixo, lida só por `service_role`

O token de sistema da Meta vai para o Supabase Vault sob o nome fixo
`marketing_meta_access_token`, gravado pelo cofre já existente
(`config.fn_definir_segredo_integracao`, `0103`, só superadmin) e lido por
`marketing.fn_token_meta()` — `security definer`, `grant execute` **só** para `service_role`.

Nome fixo, não leitor genérico por chave: um `fn_ler_segredo(p_chave)` aberto a `service_role`
transformaria qualquer função do projeto em leitora de qualquer segredo do cofre. Mesmo cuidado que
`1847_E02-S35` tomou ao restringir sua referência opaca por regex.

Metadado não-sensível (conta `act_<id>`, se está ativa, quando foi configurada) fica em
`marketing.contas_anuncio` — nunca o token.

### 5. Sem API real nesta entrega: adapter pronto, fixtures no lugar

O adapter `MetaGraphPort` tem duas implementações: `MetaGraphHttp` (fala com
`graph.facebook.com/<versao>/act_<id>/insights`, pronta, não exercitada em produção) e
`MetaGraphFixture` (lê um JSON determinístico). A Edge Function escolhe pela presença do token:
**sem segredo no cofre, ela roda em modo fixture e diz isso na resposta**, em vez de falhar em
silêncio ou fingir dado real.

A tela, as métricas, a agregação, a RLS e os testes são todos exercitados ponta a ponta com
fixture. Quando o token chegar, troca-se a implementação da porta e nada mais.

### 6. Fora de escopo — vinculante

**Escrever na API da Meta está fora de escopo.** Criar campanha, pausar campanha, ajustar
orçamento, subir criativo: nada disso entra, nem como botão desligado. O módulo é **leitura e
atribuição**. Consequência de projeto: o token pedido é de leitura (`ads_read`), não
`ads_management`, e a `MetaGraphPort` só declara operações de leitura — não há método de escrita
para alguém "só ligar depois".

Também fora: calendário editorial e geração de conteúdo com IA (descrição do módulo em
`modulos.ts`), que continuam não implementados e seguem anunciados como tal.

## Consequências

- O Marketing passa a ter dado próprio e sai do placeholder "Em construção".
- Um segundo contexto passa a ler `comercial.*`, e isso acontece em **exatamente uma** função
  (`marketing.fn_receita_por_campanha`). Qualquer ampliação futura da atribuição passa por ali, o
  que mantém o ponto de revisão único.
- Enquanto a Meta não estiver conectada, os números da tela são de fixture. A tela declara isso: o
  recurso desligado se anuncia, não some (E00-S28).
- Se a Meta mudar o formato de `insights`, quebra a `MetaGraphHttp` e mais nada — domínio, schema e
  tela não conhecem o formato da plataforma.

## Alternativas descartadas

- **Tudo em `public` com coluna `modulo`.** Joga fora o isolamento por schema que o perfil OS deste
  projeto já tem e transforma toda policy em filtro de linha. Descartado.
- **Marketing importando `features/comercial` no front** para montar o funil. Viola a fronteira do
  `CLAUDE.md` e duplicaria regra de etapa/perda. Descartado.
- **Guardar o token em `marketing.contas_anuncio`.** Credencial em tabela Postgres é dívida de
  segurança por construção (`seguranca/os-grade.md`). Descartado.
- **Sincronizar só o dia anterior.** Mais barato e errado: a Meta revisa números retroativamente.
  Descartado em favor da janela de reprocessamento.
- **Esperar a Meta ser conectada para começar.** Deixaria schema, RLS, atribuição e tela sem
  nenhuma prova. Descartado em favor de fixtures com adapter pronto.
