# Tasks — E01-S194

- [x] T1 — Achado prévio: `fn_operacao_alterar_status_lote` sem validação de transição nem
  capacidade (AC-7/AC-10); dead-end de 'demanda' em `sso_criar_os_chamado` (AC-4/AC-9),
  documentado na própria migration 1854 da E01-S193.
- [x] T2 — Migration `1855`: `fn_operacao_alterar_status_lote` exige `execucao.validar` pra
  entrar em `finalizado`; aceita `validacao_pcm` (AC-10, parcial de AC-7).
- [x] T3 — Migration `1855`: `sso_criar_os_chamado` aceita Chamado em `demanda`, OS nasce em
  `planejamento` — via cirurgia de texto sobre `pg_get_functiondef` (preserva remendos de
  `1475`/`1499`; confirmado reproduzindo e corrigindo a regressão antes do commit) (AC-4/AC-9).
- [x] T4 — `pcm-auvo-webhook`/`pcm-auvo-tasks-import`: tarefa finalizada no Auvo mapeia pra
  `validacao_pcm`, não `finalizado` direto; side-effects de campo (`chegouAoCampo`) disparam em
  ambos (AC-8).
- [x] T5 — `pcm.operacao_itens`: branch sintético estendido pra `status in ('aberto','demanda')`
  com status dinâmico — Demanda sem OS aparece no Kanban (AC-1/AC-4).
- [x] T6 — 3 agregados de "etapas mistas" ganham `validacao_pcm` na whitelist (sem isso, falso
  negativo silencioso).
- [x] T7 — pgTAP `E01-S194_validacao_pcm_status.test.sql` (14 assertions) + testes Deno
  atualizados (`pcm-auvo-tasks-import/index.test.ts`).
- [x] T8 — Frontend: `StatusOrdemServico`/`STATUS_OS` ganham `validacao_pcm`;
  `kanban-colunas.ts` reordenado pro quadro aprovado (AC-1); `backlog`/`cancelado`/`corretiva`
  saem do padrão (AC-2/AC-3); `demanda` entra como coluna virtual.
- [x] T9 — Testes de `kanban-colunas` (domain + application) atualizados pro novo conjunto;
  confirma que preferência salva antiga com coluna extinta não a ressuscita.
- [ ] T10 — SPEC_DEVIATION: "Campo a conciliar" (AC-5) não virou coluna — fonte real
  (`pcm.sso_origem_campo_processamentos`, E01-S175) não mapeada a tempo. Story de continuação.
- [ ] T11 — SPEC_DEVIATION: matriz de transição completa (AC-7) — só `finalizado` ganhou gate;
  resto do dropdown de status seguirá sem validação até inventário dos chamadores.
- [ ] T12 — Verificação pendente: fluxo de UI "arrastar cartão sintético de Demanda" não
  rastreado ponta a ponta (`ConversaoIntegral.tsx`) — RPC-level provado via pgTAP, UI não.
- [x] T13 — Suíte local: pgTAP completa (269 arquivos/3403 testes, PASS), Deno check + test
  (425 PASS) nas Edge Functions tocadas, typecheck `apps/web` (0 erros), `biome-baseline.mjs`
  (zero dívida nova). `vitest run` completo mostrou 20 falhas pré-existentes **idênticas com e
  sem o diff desta story** (confirmado por `git stash` A/B) — ambiente local, não regressão;
  suíte scoped (`src/features/pcm`) e os arquivos tocados (`kanban-colunas`, `ordens-servico`,
  `OsKanbanView`) passam limpos isoladamente.

## Definition of Done

- AC-8/AC-10 fechados com prova (pgTAP + Deno). AC-4/AC-9 fechados com prova (pgTAP).
- AC-1/AC-2/AC-3/AC-6 fechados no frontend (coluna/painel/filtro).
- AC-5/AC-7 (parcial)/verificação de drag parcial: SPEC_DEVIATION explícito, sem silêncio.
- Nenhum gate aberto sem sign-off humano separado.
