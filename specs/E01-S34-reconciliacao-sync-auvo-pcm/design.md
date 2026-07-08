---
name: design
description: Arquitetura — liga o cron do motor genérico, adiciona OS/Tarefas ao ciclo de reconciliação Auvo→PCM.
alwaysApply: false
---

# Design — Reconciliação Auvo→PCM

## Componentes

### 1. `pcm.fn_invoke_auvo_pull(p_entities text[])` — RPC de disparo em lote
Função `security definer` (mesmo padrão de `fn_apply_auvo_sync`/migration `0024`/`0025`) que, para
cada entidade da lista, chama `net.http_post` contra `pcm-auvo-pull` com `{entity: <key>}`, reusando
os secrets do Vault já criados em `0011`/`0013`/`0025` (sem secret novo). Roda dentro de um `LOOP`
com `perform pg_sleep(2)` entre chamadas — evita rajada simultânea de N requisições ao Auvo no
mesmo segundo (risco sinalizado no `product.md`).

### 2. `pg_cron` — dois jobs, um por schedule já declarado no registry
Nenhum mecanismo novo de agendamento — só liga o que já existe como metadado:
- `pcm_auvo_pull_diario` (`0 6 * * *`): chama `fn_invoke_auvo_pull` com
  `['tipos_tarefa','segmentos','palavras_chave','produto_categorias','equipamento_categorias','cliente_grupos']`
  (as 6 entidades com `cronSchedule:'0 6 * * *'` no registry).
- `pcm_auvo_pull_6h` (`0 */6 * * *`): chama `fn_invoke_auvo_pull` com
  `['ferramentas','servicos','equipes']` (as 3 entidades com `cronSchedule:'0 */6 * * *'`).

A lista de entidades fica hardcoded na migration (mesmo padrão de `0013`, que já hardcoda nomes de
função) — é uma duplicação consciente do que o registry TS declara, não um mecanismo genérico de
leitura de cron dinâmico (evita inventar parser de cron expression em Deno pra 2 padrões fixos).
**Se uma entidade nova ganhar `cronSchedule` no futuro, precisa entrar manualmente num desses dois
arrays (ou abrir um terceiro job, se o schedule for diferente) — documentar isso no design de quem
adicionar a próxima entidade.**

### 3. Tickets ganha `cronSchedule`
`ticketsDescriptor.cronSchedule = '0 * * * *'` (a cada hora — mais frequente que os catálogos
porque Tickets é operacional/dado vivo, não metadado de classificação). Entra num terceiro job
`pcm_auvo_pull_tickets_horario`.

### 4. `pcm-auvo-webhook` — Task cria OS quando não encontra `auvo_task_id` local
Hoje (linha ~186-189 do handler): `!os` → loga aviso e ignora (200, sem side-effect). Passa a:
1. Resolver `client_id` via `pcm.clientes.auvo_id = customerId` do payload da tarefa. Sem cliente
   sincronizado → loga aviso e ignora (mesmo comportamento de hoje) — não inventa cliente nem
   quebra o webhook; a tarefa é pega depois pelo import de reconciliação (task 4) quando o cliente
   já estiver sincronizado.
2. Com cliente resolvido: `INSERT` em `pcm.ordens_servico` com `titulo` (do payload),
   `categoria='corretiva'` (AUTO-DECISION — Auvo não tem um campo com o mesmo vocabulário de
   categoria do PCM; corretiva é o valor mais comum/seguro, ajustável manualmente depois),
   `origem='auvo'` (valor novo — `origem` não tem CHECK constraint no schema, só convenção em
   comentário, então não precisa de migration pra aceitar o valor), `origem_ref_id=taskId`,
   `numero` via a mesma lógica de `proximoNumeroChamado` já usada em `pcm-ze-agent` (dívida de
   race condition já conhecida/aceita nesse padrão), `status` resolvido pela máquina de transição
   já existente (`resolveTargetStatus`), `auvo_task_id=taskId`, `created_by` = usuário de sistema
   (reusa `obterUsuarioSistema` de `pcm-auvo-customers-import` — primeiro superadmin/supervisor
   ativo, mesmo padrão).
3. Segue o fluxo normal a partir daí (upsert de snapshot rico, vínculo de equipamento) — nenhuma
   duplicação de lógica, só entra mais cedo no mesmo pipeline que já existe pra OS conhecidas.

### 5. `pcm-auvo-tasks-import` — nova Edge Function (backfill + rede de segurança)
Mesmo padrão de `pcm-auvo-customers-import` (`E01-S13`): pagina `GET /tasks` inteiro, e para cada
tarefa sem `pcm.ordens_servico.auvo_task_id` correspondente, tenta criar (mesma lógica do item 4,
reaproveitada como função compartilhada `resolverOuCriarOsDaTarefa` em `_shared/auvo/`). Diferente
de `customers-import`, **não faz soft-delete de OS que sumiram do Auvo** — OS é dado operacional
do PCM, uma tarefa cancelada/removida no Auvo não deveria apagar/desativar histórico de OS local
(assimetria intencional, documentada em `tasks.md`). Cron diário (`0 5 * * *` — 1h antes do cron
de catálogo, pra não competir por rate limit no mesmo minuto) + invocação manual pós-deploy (mesmo
padrão de `pcm-auvo-webhooks-register`).

## Contrato de dados — payload mínimo de tarefa Auvo usado
Reaproveita o mesmo parsing de `evento`/`payload` já existente em `pcm-auvo-webhook` (`resolveTargetStatus`,
`extractEquipmentId`) — nenhum novo mapeamento de campo Auvo precisa ser descoberto, só o
`customerId` (já usado por `clientesDescriptor.fromAuvo` desde `E01-S27`) pra resolver `client_id`.

## Riscos
- Ver `product.md` → Riscos (rajada de chamadas, `numero` por `count()`, cliente não sincronizado).
- `pcm-auvo-webhook` é código de produção ativo desde `E01-S10` — mudança feita como adição no
  branch `if (!os)` existente, sem tocar no caminho de OS já conhecida (zero risco de regressão no
  fluxo que já funciona).
