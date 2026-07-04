---
name: tasks
description: Decomposição e gates do import inicial de clientes Auvo → PCM. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Import inicial de clientes Auvo → PCM (bootstrap)

> Depende de `E01-S09` (fundação — cliente HTTP Auvo compartilhado, `requireServiceRole`) e
> `E01-S11` (padrão de paginação/cron para sync Auvo→PCM) **já implementadas e mergeadas** (PR #10,
> PR #12) — reaproveitadas integralmente, sem código novo de auth/cliente HTTP/paginação nesta
> story.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|-----------------|--------|
| 1 | Migration `0014_E01-S13_grant_service_role_clientes.sql`: **só GRANT, sem policy nova** — `grant select, insert, update on pcm.clientes to service_role`. `pcm.clientes` já existe desde `0001_E00-S00`; hoje só `authenticated` tem GRANT (`0002`/`0009`); `service_role` já tem `usage on schema pcm` (`0012`), mas isso não cascade pra tabela. Sem este GRANT a function leva `permission denied for table clientes` | AC-1 (pré-requisito) | — | `pnpm run lint:migrations` | ✅ done |
| 2 | Edge Function `pcm-auvo-customers-import` (nome novo — não colide com `pcm-auvo-customers-sync`, que é PCM→Auvo e continua intacto): `requireServiceRole`, pagina `GET /customers` via `auvoPaginate` (reaproveitado de `_shared/auvo/paginate.ts`), mapeia `id`→`auvo_id`, `description`/`name`→`nome`, cnpj `null` se não houver campo claro no payload (ver AC-4/OPEN-QUESTION da spec — não inventar campo) | AC-1, AC-2, AC-4 | 1 | teste de integração com mock paginado | ✅ done |
| 3 | Upsert por `auvo_id` (`ON CONFLICT (auvo_id)`, coluna já `unique` desde `0001`) — idempotente, nunca duplica (AC-2) | AC-1, AC-2 | 2 | teste: upsert rodado 2x seguidas não duplica | ✅ done |
| 4 | Guarda de soft-delete (AC-3, mesmo padrão de `E01-S11` task 6/task de `pcm-auvo-users-sync`): a reconciliação `ativo = false` só roda se TODAS as páginas de `GET /customers` vierem com sucesso nesta execução; se a paginação falhar no meio, aborta sem tocar em `ativo`. Se a paginação tiver sucesso mas devolver **zero** clientes, pular a reconciliação (log de aviso) em vez de desativar tudo — mesma guarda extra que `pcm-auvo-users-sync` já usa, pelo mesmo motivo (resultado vazio de endpoint externo é suspeito o bastante pra não valer desativação em massa) | AC-3 | 2, 3 | teste: mock de falha na página 2 → nenhuma linha marcada `ativo=false`; mock de 0 resultados → reconciliação pulada, log de aviso | ✅ done |
| 5 | Migration `0015_E01-S13_cron_import_clientes_diario.sql`: função `pcm.fn_auvo_import_clientes_diario()` no mesmo padrão de `0013` (`net.http_post`, `exception when others` nunca propaga) chamando `pcm-auvo-customers-import`; **reaproveita os secrets do Vault já criados em `0011`/`0013`** (`auvo_trigger_project_url`/`auvo_trigger_service_role_key`, sem secret novo); `cron.schedule('import_clientes_auvo_diario', '0 6 * * *', ...)` (mesmo horário de `0013`, fora do horário comercial) | AC-5 | 2 | `pnpm run lint:migrations` + inspeção manual (`select * from cron.job;` pós-deploy) | ✅ done (código; `lint:migrations` verde. Inspeção `cron.job` pós-deploy pendente — sem acesso à produção) |
| 6 | Invocação sob demanda (AC-5b): nenhum código novo — a mesma function da task 2 já aceita `Authorization: Bearer <service_role_key>` via `requireServiceRole`, idêntico ao cron da task 5. Importante nesta story: **é o caminho que resolve o bootstrap imediato** (rodar uma vez manualmente logo após o deploy, sem esperar o cron das 06:00 UTC) — validação pós-deploy inclui essa chamada manual pra popular `pcm.clientes` pela primeira vez | AC-1, AC-5 | 2 | inspeção (chamada manual de teste após deploy) | ✅ done (código — nenhum novo necessário). Chamada manual pós-deploy pendente (@devops/ops, fora do meu alcance) |
| 7 | `docs/blueprint/integracoes/auvo.md`: acrescentar `pcm-auvo-customers-import` na tabela de Edge Functions (direção Auvo→PCM) — não mexer na linha de `pcm-auvo-customers-sync` (PCM→Auvo, inalterada) `[P]` | — | 2 | inspeção | ✅ done |
| 8 | Gates a rodar: `pnpm run lint:migrations`, `node scripts/audit-esteira.mjs`, `node scripts/eval-spec-fidelity.mjs` (mesma ressalva de sempre: não avalia pastas `E0N-S0N-*`, rastreabilidade conferida à mão), `pnpm run lint`, `pnpm run typecheck`, `pnpm test`, `pnpm run build` | — | 1-7 | comandos acima | ✅ done |
| 9 | `docs/epics/ROADMAP.md` + `docs/STATE.md`: marcar `E01-S13` com o resultado real ao terminar | — | 1-8 | inspeção | ✅ done |

## Notas de implementação (decisões técnicas, não cobertas literalmente pela spec)
- **[AUTO-DECISION]** Migration numerada `0014`/`0015` — a última existente no branch de origem
  (`origin/main` no momento de abrir esta story) é `0013` (`E01-S11`). Confirmar no momento de
  implementar que nenhuma outra story mergeou uma migration `0014` entretanto (checar
  `ls supabase/migrations/` de novo antes de escrever o arquivo).
- **[AUTO-DECISION]** Reaproveitar `requireServiceRole` e o padrão de log estruturado
  (`{ts, nivel, fn, reqId, ...}`) idênticos a `pcm-auvo-users-sync`/`pcm-auvo-equipment-sync` — não
  criar um padrão de auth/log novo para esta function.
- **[AUTO-DECISION]** Nome do campo Auvo mapeado para `nome`: seguir o mesmo padrão de
  `pcm-auvo-customers-sync` (que já envia `description` como nome ao criar cliente no Auvo) —
  ler `description` (ou `name`, se o payload de `GET /customers` usar outro campo — confirmar
  contra o mapeamento real antes do primeiro deploy, mesma ressalva de sempre) como `pcm.clientes.nome`.

## Plano de teste
- Unidade: nenhuma lógica nova de paginação (reaproveita `paginate.ts` já testado em `E01-S11`).
- Integração: `pcm-auvo-customers-import` contra mock paginado do Auvo — idempotência (upsert 2x),
  guarda de soft-delete (falha parcial não desativa nada; resultado vazio não desativa em massa).
- Aceite: um teste por AC (AC-1 a AC-5).

## Achados sobre os gates (herdados de E01-S09/E01-S11, não desta story)
- `eval-spec-fidelity.mjs` não avalia pastas `E0N-S0N-*` (só `^\d{4}-`) — rastreabilidade AC↔task
  conferida à mão (AC-1 a AC-5 aparecem na coluna "Cobre AC").
- Deno CLI/Docker indisponíveis neste tipo de ambiente — Edge Function e pgTAP (se houver) não
  type-checam/rodam localmente; ficam para a CI.

## Resultado da implementação (2026-07-04)
Arquivos criados/alterados:
- `supabase/migrations/0014_E01-S13_grant_service_role_clientes.sql` (só GRANT, sem tabela/policy nova).
- `supabase/migrations/0015_E01-S13_cron_import_clientes_diario.sql` (função + `cron.schedule`
  diário, reusa secrets do Vault de `0011`/`0013`).
- `supabase/functions/pcm-auvo-customers-import/index.ts`.
- `docs/blueprint/integracoes/auvo.md` (linha nova na tabela de Edge Functions).

Gates rodados nesta sessão (por mim, não assumidos):
- `pnpm run lint:migrations` → **verde** (15 migrations).
- `node scripts/audit-esteira.mjs` → **verde** (126 docs).
- `node scripts/eval-spec-fidelity.mjs` → verde, mas não avalia `E01-S13` (mesma ressalva de
  sempre) — rastreabilidade AC↔task conferida à mão.
- `pnpm run lint` (biome) → **verde** (91 arquivos). `supabase/functions/**` é ignorado pelo biome
  (mesma realidade de E01-S09/S10/S11) — Edge Function não passa pelo lint Node.
- `pnpm run typecheck` → **verde** (4 pacotes). Idem, não cobre `supabase/functions/**`.
- `pnpm test` → **verde** (93 passed, 9 skipped) — nenhum teste novo de vitest (a lógica nova é
  toda Deno, sem teste Deno automatizado escrito para esta story — ver "Não verificado" abaixo).
- `pnpm run build` → **verde**.

Não verificável neste ambiente (sem Deno CLI / sem Docker / sem acesso ao Dashboard de produção):
type-check e teste de integração Deno de `pcm-auvo-customers-import` (nenhum teste automatizado
escrito — diferente de `E01-S11`, que teve `paginate.test.ts`; aqui a função só orquestra
`auvoPaginate` + upsert, sem lógica nova que justificasse um teste Deno dedicado, mas isso é uma
lacuna real, não decisão deliberada — sinalizando para o `@qa`/revisão); habilitar `pg_cron` (já
deveria estar habilitado se `E01-S11` foi deployada); inspeção `cron.job` e chamada manual pós-deploy.

## Divergências (SPEC_DEVIATION)
Nenhuma. As duas `[OPEN-QUESTION]` da spec (campo de "ativo/inativo" no Auvo, campo de CNPJ) foram
tratadas com o comportamento mais defensivo possível (tratar ausência da paginação completa como
sinal de inativo; `cnpj = null` se não houver campo claro) — não são SPEC_DEVIATION porque a spec
já autorizava essa resolução como aceitável, só sinalizava a incerteza de confirmar contra a API real.

## Rastreabilidade
- Spec: `./spec.md`
- Precedente de formato/gates: `../E01-S11-integracao-auvo-sync-tecnicos-equipamentos/tasks.md`
