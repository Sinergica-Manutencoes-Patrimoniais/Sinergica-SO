---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Visão 360 do Cliente (v1, página read-only por condomínio)

> **Fonte da verdade.** Status: aprovado pelo Lucas em 2026-07-03 (ver `product.md` §6) —
> pronto para `@sm` quebrar em `tasks.md`.
> Tier: **Pequeno** (leitura/agregação sobre tabelas que já existem — `pcm.clientes`,
> `pcm.ordens_servico`; sem novo bounded context, sem RLS nova por cliente, reaproveita o gating
> de módulo PCM de E00-S09/S10). Sem `design.md` próprio.

## Resumo
Uma **sub-tela dentro do módulo PCM/Operação** que consolida, numa única página **somente leitura**
por condomínio, o cadastro do cliente, o backlog priorizado por GUT (OS em aberto) e o histórico de
OS (concluídas/canceladas, com status sincronizado do Auvo) — eliminando o cruzamento manual
Auvo + planilha + WhatsApp para responder "o que está pendente" e "o que já foi feito" daquele
cliente. Um painel condicional de técnicos/equipamentos vinculados aparece quando o cache do Auvo
(E01-S11) já existir, degradando graciosamente quando não existir.

Toda a leitura sai das **mesmas tabelas e policies** já usadas pelo backlog GUT (E01-S01) e pela
integração Auvo (E01-S09/S10) — a v1 **não cria uma segunda "verdade"** e não adiciona escrita.

## Modelo de dados assumido (não inventar além disto)
- `pcm.clientes`: `id`, `nome`, `cnpj`, `auvo_id` (bigint, nullable), `ativo` (boolean), `deleted_at`
  (migration `0001_E00-S00`).
- `pcm.ordens_servico`: `id`, `client_id` → `pcm.clientes`, `numero`, `titulo`, `descricao`,
  `categoria`, `status`, `prioridade`, `gravidade`/`urgencia`/`tendencia` (1–5, nullable),
  `score_pcm` (**GENERATED** = `coalesce(g,1)*coalesce(u,1)*coalesce(t,1)`, índice
  `idx_os_score_desc`), `auvo_task_id`, `auvo_sync_status`, `auvo_synced_at`, `auvo_sync_error`,
  `deleted_at` (migration `0001_E00-S00`; GUT = E01-S01; colunas `auvo_*` alimentadas por
  E01-S09/S10).
- **Ciclo de status da OS** (E01-S09/S10): `solicitacao` (default) → `planejamento` →
  `em_execucao` → `finalizado` | `cancelado`.
  - **Em aberto / andamento** (backlog): `status NOT IN ('finalizado','cancelado')`.
  - **Histórico**: `status IN ('finalizado','cancelado')`.
  - [AUTO-DECISION] `em_execucao` conta como "em aberto/andamento" (aparece no backlog, não no
    histórico) → garante que **nenhuma OS suma** da tela (regra "aberta = ainda não concluída/
    cancelada"). Razão: alternativa (bucket próprio "em execução") é refinamento de UI de fase 2;
    a v1 não pode perder OS entre os dois painéis. Lucas pode dividir depois sem quebrar o contrato.
- `pcm.tecnicos_cache` / `pcm.equipamentos_cache`: tabelas do cache Auvo→PCM de **E01-S11** (cache
  read-only; `equipamentos_cache` vincula ao cliente via `pcm.clientes.auvo_id`). **Podem ainda não
  existir** neste ponto (E01-S11 em implementação paralela) — ver AC-6.
- Todo filtro de OS e de cliente aplica `deleted_at IS NULL` (soft delete, convenção do schema).

## Critérios de aceite

### AC-1: Acesso segue o gating de módulo PCM já existente (não é permissão nova)
- **Dado** um usuário autenticado
- **Quando** ele tenta abrir a Visão 360 de um cliente
- **Então** a tela só renderiza se `usePermissoes().podeAcessar('pcm', 'leitura')` for verdadeiro
  (a mesma checagem já usada pelas demais telas do PCM, de E00-S09/S10); sem permissão de leitura
  no módulo `pcm`, a tela não é acessível — **nenhuma policy/permissão nova é criada** e nenhuma RLS
  por cliente é adicionada (todo `colaborador` com acesso ao PCM vê qualquer cliente, conforme
  `product.md` §6.3).

### AC-2: Cabeçalho do cliente renderiza os dados de cadastro
- **Dado** um `pcm.clientes` existente (`deleted_at IS NULL`)
- **Quando** a Visão 360 desse cliente é aberta
- **Então** o cabeçalho exibe `nome`, `cnpj`, um indicador de `ativo` (ativo/inativo) e o `auvo_id`;
  quando `cnpj` ou `auvo_id` forem nulos, exibe um rótulo neutro (ex.: "—" / "não sincronizado")
  **sem quebrar** a renderização (é cadastro, não contrato — termos de contrato estão fora do v1,
  ver Fora de escopo).

### AC-3: Backlog GUT do cliente — OS em aberto, ordenadas por `score_pcm` desc
- **Dado** um cliente com OS em aberto (`status NOT IN ('finalizado','cancelado')` e
  `deleted_at IS NULL`)
- **Quando** a Visão 360 é aberta
- **Então** o painel "Backlog" lista essas OS **ordenadas por `score_pcm` desc** (aproveitando
  `idx_os_score_desc`), com desempate determinístico por `created_at` desc (mais recente primeiro),
  exibindo pelo menos `numero`, `titulo`, `categoria`, `status` e o `score_pcm` (ou `G·U·T`); a
  ordenação é a **mesma verdade** do backlog GUT de E01-S01, sem recalcular no client.

### AC-4: Histórico de OS do cliente — concluídas/canceladas com status sincronizado do Auvo
- **Dado** um cliente com OS em `status = 'finalizado'` ou `status = 'cancelado'`
  (`deleted_at IS NULL`)
- **Quando** a Visão 360 é aberta
- **Então** o painel "Histórico" lista essas OS **separadas** do backlog, ordenadas por
  `auvo_synced_at` desc com fallback `created_at` desc, exibindo pelo menos `numero`, `titulo`,
  `categoria` e o `status` atual — que reflete a sincronização de campo do Auvo (via webhook
  E01-S10; campos `auvo_sync_status` / `auvo_task_id` disponíveis para exibição/diagnóstico).

### AC-5: Cliente sem nenhuma OS — estado vazio, não erro
- **Dado** um cliente existente que ainda não tem nenhuma `pcm.ordens_servico`
- **Quando** a Visão 360 é aberta
- **Então** o cabeçalho (AC-2) renderiza normalmente e os painéis Backlog e Histórico exibem um
  **estado vazio explícito** (ex.: "Nenhuma OS em aberto" / "Nenhum histórico ainda") — **nunca**
  uma mensagem de erro nem tela quebrada.

### AC-6: Painel de técnicos/equipamentos vinculados — condicional, com degradação graciosa
- **Dado** que o cache Auvo→PCM de E01-S11 (`pcm.equipamentos_cache` / `pcm.tecnicos_cache`)
  **pode ou não** já existir/estar populado nesta build
- **Quando** a Visão 360 é aberta
- **Então**:
  - **Se** `pcm.equipamentos_cache` existir e houver equipamentos vinculados ao cliente
    (via `pcm.clientes.auvo_id`) **e** `ativo = true`, o painel os lista;
  - **Se** a tabela não existir (E01-S11 ainda não mergeada), OU estiver vazia para esse cliente,
    OU o cliente tiver `auvo_id IS NULL`, o painel exibe um **placeholder/estado vazio** (ex.:
    "Integração de campo indisponível" / "Sem equipamentos vinculados") — **sem lançar erro e sem
    quebrar o resto da tela**. A ausência do cache **não é bloqueante** para o restante da v1
    (cabeçalho + backlog + histórico continuam funcionando).
  - A associação de **técnicos por cliente** não é derivável do schema atual (ver
    `[OPEN-QUESTION #1]`); enquanto não resolvida, o painel cobre **equipamentos**, e técnicos
    ficam adiados/placeholder — sem inventar vínculo inexistente.

### AC-7: Tela é somente leitura — nenhuma ação de escrita disponível
- **Dado** a Visão 360 aberta com qualquer conjunto de dados
- **Quando** o usuário interage com a tela
- **Então** **nenhuma** ação de mutação está disponível: não há editar OS, repriorizar/alterar GUT,
  mudar status, criar OS, nem disparar sync/ação a partir daqui. As únicas interações permitidas são
  leitura, filtro/ordenação client-side e (opcionalmente) navegação para a tela de origem
  (ex.: Hub de OS, quando existir). Toda escrita permanece nas telas de origem.

### AC-8: Cliente inexistente ou removido — "não encontrado", não crash
- **Dado** um `client_id` que não existe ou está soft-deleted (`deleted_at IS NOT NULL`)
- **Quando** a Visão 360 é aberta para esse id
- **Então** a tela exibe um estado "cliente não encontrado" claro, **sem** erro genérico/tela em
  branco e sem vazar detalhes de implementação.

## Casos de borda e erros
- **OS soft-deleted** (`deleted_at IS NOT NULL`): excluída de ambos os painéis (backlog e
  histórico) — não conta em nenhum lugar.
- **OS com `gravidade`/`urgencia`/`tendencia` nulos**: `score_pcm` = 1 (pela GENERATED
  `coalesce(...,1)`) — a OS aparece no **fim** do backlog, sem quebrar a ordenação.
- **Empate de `score_pcm`** no backlog: desempate determinístico por `created_at` desc (AC-3) —
  ordem estável entre renders, nunca aleatória. [AUTO-DECISION] critério de desempate é detalhe de
  apresentação; escolhido `created_at` desc por ser determinístico e já indexável.
- **Cliente com `auvo_id IS NULL`**: painel de equipamentos entra em estado vazio (não há chave de
  vínculo com o Auvo) — não é erro (AC-6).
- **E01-S11 ausente**: a query/consulta ao cache deve ser **feature-detectada** (a ausência da
  tabela é tratada como "painel indisponível", não como exceção que derruba a página) — AC-6.
- **Volume alto de histórico**: a v1 pode paginar/limitar o histórico exibido (ex.: últimas N),
  desde que o backlog em aberto seja sempre exibido por completo (é a informação de decisão). O
  tamanho/estratégia de paginação é detalhe de implementação do `@dev`.

## Fora de escopo
> **Vinculante.** Reforça `product.md` §4 — cada item está fora porque o módulo que o sustenta
> ainda não foi construído (é sequenciamento, não "não fazer"). Não implemente nada aqui.
- **Árvore de ativos / equipamentos com ficha técnica, hierarquia e prontuário** — depende da
  Gestão de Ativos (não construída). A v1 só pode listar o cache plano do Auvo (E01-S11), sem
  ficha/hierarquia/ciclo de vida.
- **Calendário preventivo / PMOC** — depende do PMOC (E01-S03–S08, não construído; `pcm.pmoc_records`
  não existe — confirmado pelo AC-7 deferido de E01-S10).
- **Situação financeira** — depende do Financeiro (E04); não há tabelas financeiras no schema.
- **Linha do tempo de comunicação (WhatsApp)** — depende da integração Evolution (não implementada;
  só existe o stub `atendimento.wa_messages`/`config_ze` do Agente Zé).
- **Contrato com termos operacionais** (visitas/semana, horas/visita) e **indicador de saúde do
  contrato** — as colunas não existem em `pcm.clientes`.
- **Hierarquia `Administradora → Condomínio → Torre/Bloco`** — `pcm.clientes` é plano; a v1 é uma
  página por cliente/condomínio, sem visão de portfólio de administradora.
- **Relatórios sob demanda / exportação** da tela — só visualização na v1.
- **Qualquer escrita** a partir da Visão 360 (editar OS, repriorizar, mudar status, disparar
  sync/ação) — a v1 é estritamente read-only; ações ficam nas telas de origem (Hub de OS E01-S07 etc.).
- **Nova RLS/policy por cliente ou por carteira** — `product.md` §6.3 confirmou visibilidade
  ampla; a tela reaproveita as policies de módulo PCM já existentes, sem elevação de permissão.
- **Área do Cliente (síndico)** — acesso do próprio síndico a esta visão é E09 (não construído).

## Rastreabilidade
- Product / decisões do usuário: `./product.md` (§3 escopo v1, §4 fora de escopo, §6 decisões de
  2026-07-03).
- Origem do escopo: `docs/ESCOPO-MESTRE.md` §"⭐ Visão 360 do Cliente" (dor L1).
- Modelo de dados: `supabase/migrations/0001_E00-S00_schemas_dominio.sql` (`pcm.clientes`,
  `pcm.ordens_servico`, `score_pcm` GENERATED, `idx_os_score_desc`).
- GUT / ordenação do backlog: E01-S01 (`specs/0001-priorizacao-backlog-gut/spec.md`).
- Status de OS sincronizado do Auvo: E01-S09 (`specs/E01-S09-integracao-auvo-fundacao/`),
  E01-S10 (`specs/E01-S10-integracao-auvo-webhook-status/`) — colunas `auvo_*` e ciclo de status.
- Painel condicional (cache): E01-S11
  (`specs/E01-S11-integracao-auvo-sync-tecnicos-equipamentos/spec.md` e `tasks.md` —
  `pcm.tecnicos_cache`, `pcm.equipamentos_cache`).
- RBAC / gating de módulo: E00-S08/S09/S10 — `apps/web/src/app/permissoes-context.tsx`
  (`PermissoesProvider`, `usePermissoes().podeAcessar`),
  `apps/web/src/features/config/domain/modulo.ts` (`ModuloId = 'pcm'`, `NivelAcesso = 'leitura'`).

## Questões em aberto (decisão de negócio — reportadas, não inventadas)

> Registradas conforme a política de elicitação: são decisões de produto/dado que nem o
> `product.md` nem o schema resolvem. Não bloqueiam a maior parte da v1 (cabeçalho + backlog +
> histórico + read-only + gating). O `@dev` pode entregar tudo isso sem elas.

- **[OPEN-QUESTION #1] Como associar TÉCNICOS a um cliente específico na v1?**
  O schema não fornece o vínculo: `pcm.tecnicos_cache` (E01-S11) tem apenas
  `auvo_user_id`/`nome`/`equipe`/`ativo`, **sem coluna de cliente**, e `pcm.ordens_servico` **não
  tem** campo de técnico atribuído. Equipamentos têm vínculo por cliente (`equipamentos_cache` →
  `auvo_id`); técnicos, não. *Opções consideradas:* (a) v1 mostra **só equipamentos** vinculados e
  adia técnicos para quando E01-S11 (ou o Hub de OS) expuser atribuição por OS/cliente
  — **recomendação do @analyst**, é o único caminho que não inventa vínculo; (b) listar todos os
  técnicos do cache globalmente (pouco útil, não é "vinculado ao cliente"); (c) esperar E01-S11
  expor atribuição por OS. **Impacto se não resolvida:** AC-6 cobre equipamentos e trata técnicos
  como painel adiado/placeholder — não bloqueia a v1.

- **[OPEN-QUESTION #2] O histórico deve exibir OS `cancelado` junto de `finalizado`, ou separá-las?**
  `product.md` §3 diz "OS concluídas/canceladas" no mesmo painel Histórico — foi o que a spec
  assume (AC-4). Fica só o registro de que, se o gestor preferir distinguir visualmente
  "concluída" de "cancelada" (ex.: badge/seção), é um refinamento de UI de fase 2, não um novo
  requisito. Não bloqueia.
