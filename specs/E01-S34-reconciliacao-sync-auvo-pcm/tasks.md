---
name: tasks
description: Decomposição e gates — liga cron real do motor genérico + reconciliação de OS/Tarefas.
alwaysApply: false
---

# Tasks — Reconciliação Auvo→PCM

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `0037_E01-S34_cron_auvo_pull.sql`: `pcm.fn_invoke_auvo_pull(p_entities text[])` (security definer, `net.http_post` por entidade com `pg_sleep(2)` entre chamadas, reusa secrets do Vault de `0011`/`0013`/`0025`) + 2 `pg_cron.schedule` (`0 6 * * *` com as 6 entidades diárias, `0 */6 * * *` com as 3 de 6h) | AC-1 | E01-S22..S33 mergeadas | `lint:migrations` | feito |
| 2  | `registry/tickets.ts`: adicionar `cronSchedule: '0 * * * *'` + migration adiciona job `pcm_auvo_pull_tickets_horario` | AC-2 | 1 | `lint:migrations` + teste Deno do descriptor atualizado | feito |
| 3  | `_shared/auvo/os-from-task.ts`: função pura `resolverCategoriaDefault()`/helpers + função com I/O `criarOsDaTarefa(db, evento, taskId, logBase)` (resolve `client_id`, gera `numero`, insere OS, retorna `{id,status}` ou `null` se cliente não sincronizado) — compartilhada entre webhook (task 4) e import (task 5) | AC-3, AC-4 | — | teste Deno da função pura | feito |
| 4  | `pcm-auvo-webhook/index.ts`: no branch `if (!os)`, chamar `criarOsDaTarefa`; se retornar OS, seguir o mesmo fluxo de snapshot/vínculo de equipamento que o caminho de OS conhecida já usa; se retornar `null`, mantém o log+ignore atual | AC-3, AC-4, AC-6 | 3 | teste Deno de regressão (OS conhecida = comportamento idêntico) | feito |
| 5  | Nova Edge Function `pcm-auvo-tasks-import/index.ts` (pagina `GET /tasks`, chama `criarOsDaTarefa` por tarefa sem `auvo_task_id` local, sem soft-delete) | AC-5 | 3 | teste de integração Deno (mock HTTP Auvo) | feito |
| 6  | Migration `0038_E01-S34_cron_tasks_import.sql`: `pg_cron` diário (`0 5 * * *`) chamando `pcm-auvo-tasks-import` | AC-5 | 5 | `lint:migrations` | feito |
| 7  | Rodar `pnpm run ci:local` | todos | 1-6 | `pnpm run ci:local` | feito |
| 8  | Atualizar ROADMAP/STATE | — | 7 | revisão humana | feito |

## Plano de teste
- Unidade (Deno): `criarOsDaTarefa` — cliente resolvido cria OS com campos corretos; cliente não
  resolvido devolve `null` sem lançar; `numero` sequencial.
- Regressão (Deno): webhook com `auvo_task_id` já conhecido — resultado idêntico ao comportamento
  pré-story (nenhuma tentativa de criar).
- Integração (Deno, mock HTTP Auvo): `pcm-auvo-tasks-import` — paginação completa, tarefas com
  cliente sincronizado criam OS, tarefas sem cliente são puladas e logadas, erro de página não
  escreve nada.
- Aceite: os 6 AC de `spec.md`.

## Divergências (SPEC_DEVIATION)
- [x] Task 3: além da função pura sugerida no plano original, `resolverClienteIdPorAuvoId`/
      `proximoNumeroOs`/`obterUsuarioSistema` também viraram funções exportadas do módulo
      compartilhado (não só `criarOsDaTarefa`) — reaproveitam exatamente os padrões já existentes
      de `pcm-ze-agent`/`pcm-auvo-customers-import`, testáveis isoladamente se necessário depois.
- [x] Task 4: a ordem de checagem existente no webhook (`targetStatus == null` → ignora, ANTES de
      resolver a OS) significa que o primeiro evento de uma tarefa genuinamente nova com
      `taskStatus=1` ("Aberta") sozinho não passa a criar OS — só cria a partir do primeiro evento
      com transição de status mapeada (ex.: `taskStatus=2` em diante). Decisão consciente: não
      reordenar os checks de um handler de produção ativo desde `E01-S10` para não introduzir risco
      de regressão. O evento de criação pura fica coberto pelo import de reconciliação (AC-5), não
      é uma lacuna sem cobertura — só um atraso de "tempo real" pra "próxima rodada do cron diário".

## Checklist de Definition of Done
- [x] Todos os AC (AC-1 a AC-6) implementados em código local
- [ ] Todos os AC verdes pelo gate executável completo (Deno/pgTAP/browser — Deno CLI/Docker
      ausentes neste ambiente, mesma ressalva de toda a integração Auvo desde E01-S09)
- [x] `pcm-auvo-webhook` não regrediu o caminho de OS já conhecida (branch `else` idêntico ao
      código anterior, só reindentado dentro do novo `if/else`; revisão manual linha a linha feita
      nesta sessão, sem Deno CLI para confirmar via teste automatizado)
- [x] `docs/STATE.md`/`docs/epics/ROADMAP.md` atualizados
- [x] Gates locais verdes: `lint:migrations` (38 migrations), `lint` (cobre só apps/web —
      `supabase/functions/**` está fora do escopo do biome, ver `biome.json`), `typecheck`
      (idem, só apps/web), `test` (164 pass/9 skip), `build`, `arch:check`, `audit:esteira`
      (176 docs), `eval:spec`
- [ ] `pnpm run ci:local` verde completo no CI real (`db-tests`/Deno) — confirmar antes do merge
