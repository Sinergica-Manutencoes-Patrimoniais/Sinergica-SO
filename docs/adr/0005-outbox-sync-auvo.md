---
name: adr-0005-outbox-sync-auvo
description: Decisão de usar outbox transacional + drain como mecanismo único de propagação PCM→Auvo para toda entidade nova. Puxe ao adicionar uma entidade sincronizada com o Auvo.
alwaysApply: false
---

# ADR-0005 — Outbox transacional como mecanismo único de propagação PCM→Auvo

**Status:** Aceito
**Data:** 2026-07-07
**Decisores:** Claude (sessão Lucas), Lucas (PO)
**Relacionados:** ADR-0001 (PCM origin of truth / externalId), `specs/E01-S22-motor-sync-auvo-write/design.md`

## Contexto
A épica "PCM como front-end completo do Auvo" (plano de ~10 entidades novas: Funcionários,
Ferramentas, Serviços, Equipamentos, Categorias, Equipes, Segmentos, Tipos de Tarefa, Tickets,
Clientes-CRUD) precisa propagar toda escrita PCM para o Auvo. O padrão já existente (`E01-S09`,
`0011_E01-S09_trigger_auvo_planejamento.sql`) é um trigger Postgres que dispara `pg_net`
diretamente para uma Edge Function síncrona por entidade — funciona para 2 fluxos (Cliente, Task
de OS), mas replicado 10x traria: nenhum retry automático em falha transitória, nenhum controle
de rajada (Auvo limita a 400 req/min), e uma Edge Function quase idêntica por entidade. Essa
decisão define o mecanismo antes de qualquer entidade nova ser construída — mudar depois exigiria
retrabalhar todas as stories de entidade já implementadas.

## Decisão
1. Toda tabela `pcm.*` que sincroniza com o Auvo ganha o trigger genérico
   `pcm.fn_auvo_enqueue('<entity_key>')`, que insere uma linha em `pcm.auvo_sync_outbox`
   (`entity`, `row_id`, `op`, `status='pending'`) em vez de chamar o Auvo diretamente.
2. Uma única Edge Function (`pcm-auvo-push`), acionada por `pg_cron` a cada 1 min, drena o
   outbox: reivindica um lote `pending` (`FOR UPDATE SKIP LOCKED`), resolve o mapeamento de campos
   pelo **entity registry** (`supabase/functions/_shared/auvo/registry/`), chama o Auvo e grava o
   resultado de volta na linha de origem.
3. Idempotência por `externalId = row.id` (reaproveita ADR-0001) em toda chamada do drain.
4. Anti-loop: escritas que se originam de dados vindos do Auvo (o próprio drain confirmando
   sucesso, ou o dispatcher/poller de `E01-S23` no sentido inverso) usam um `updated_by` sentinela
   reservado (`auvo_system_user_id`) — `fn_auvo_enqueue` não enfileira quando o sentinela é o
   autor da escrita.
5. Os 2 fluxos síncronos já existentes (`pcm-auvo-customers-sync`, `pcm-auvo-create-task`)
   **não** migram para o outbox nesta decisão — continuam como estão; o outbox é o mecanismo para
   toda entidade nova a partir de `E01-S24`.

## Alternativas consideradas
| Alternativa | Prós | Contras | Por que (não) escolhida |
|---|---|---|---|
| **Outbox + drain cron** (escolhida) | Retry/backoff nativo; lote controla o budget de rate-limit; serializa por linha (`SKIP LOCKED`); uma Edge Function serve todas as entidades | +1 tabela, +1 Edge Function, +1 min de latência | É o único jeito de dar retry e não estourar 400 req/min com 10 entidades escrevendo ao mesmo tempo |
| Trigger `pg_net` direto por tabela (replicar padrão de `0011`) | Reusa o padrão já existente, zero tabela nova | Sem retry (falha vira `failed` permanente); sem controle de rajada; 1 Edge Function por entidade | Já é a dívida técnica conhecida dos 2 fluxos existentes — replicá-la 10x agrava o problema em vez de resolver |
| Fila externa (pgmq, serviço de mensageria de terceiro) | Mais robusto para volume alto | Infraestrutura nova fora do padrão 100% Supabase-nativo do projeto | Volume da Sinérgica é baixo (uma empresa, não SaaS multi-tenant) — não justifica dependência nova |

## Consequências
**Positivas:**
- Uma entidade nova = um descriptor no registry + uma migration, não uma Edge Function de disparo
  do zero.
- Retry automático e budget de rate-limit controlável por tamanho de lote, coisas que os 2 fluxos
  atuais não têm.
- Todo o mapeamento de campos PCM↔Auvo fica num único lugar por entidade (o descriptor), fácil de
  auditar/testar isoladamente.

**Negativas / trade-offs aceitos:**
- Latência de até 1 min entre a escrita no PCM e a chegada no Auvo (drain por minuto, não tempo
  real) — aceitável para cadastro, não para operações críticas de campo (que continuam no padrão
  síncrono existente).
- Sem alerta automático para linhas presas em `status='error'` nesta fase — reconciliação manual
  via consulta à tabela, mesma dívida já aceita em `E01-S09`.
- Dois padrões de propagação coexistindo no código (trigger direto para Cliente/Task de OS, outbox
  para tudo mais) — decisão consciente de não migrar o que já funciona, documentada aqui para não
  ser lida como inconsistência acidental.
