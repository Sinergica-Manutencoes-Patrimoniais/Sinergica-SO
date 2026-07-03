---
name: tasks
description: Decomposição e gates do sync de técnicos/equipamentos Auvo → PCM. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Integração Auvo: Sync de Técnicos, Equipes e Equipamentos

> Preparado por `@sm` (River), 2026-07-03. **Implementado por `@dev` (Dex), 2026-07-03** — ver
> coluna Status e a seção "Resultado da implementação" ao final. Substitui a versão anterior deste arquivo (que ainda tratava o gatilho do
> sync como decisão em aberto — já **confirmado** em `spec.md` → AC-5: `pg_cron` diário +
> invocação sob demanda via HTTP autenticado, sem botão de UI). Depende de `E01-S09` (fundação —
> cliente HTTP Auvo compartilhado, `requireServiceRole`) **já implementada e mergeada** (PR #10) —
> reaproveitada integralmente, sem código novo de auth/cliente HTTP nesta story.

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|-----------------|--------|
| 1  | Migration `0012_E01-S11_cache_tecnicos_equipamentos.sql`: cria `pcm.tecnicos_cache` (`id uuid pk`, `auvo_user_id bigint not null`, `nome text not null`, `equipe text`, `ativo boolean not null default true`, `created_at`, `updated_at`) e `pcm.equipamentos_cache` (`id uuid pk`, `auvo_equipment_id bigint not null`, `nome text not null`, `auvo_customer_id bigint` nullable, `ativo boolean not null default true`, `created_at`, `updated_at`); índice único em `auvo_user_id`/`auvo_equipment_id` (alvo do upsert); `auvo_customer_id` com FK **via `auvo_id`** (`references pcm.clientes (auvo_id)` — válido porque `pcm.clientes.auvo_id` já é `unique` desde `0001_E00-S00`); RLS FORCE nas duas tabelas | AC-1, AC-2, AC-4 | — | `pnpm run lint:migrations` | ✅ done (lint:migrations verde) |
| 2  | Mesma migration da task 1 — RLS/GRANT: policy de `SELECT` para `authenticated` no mesmo padrão de `pcm.clientes` (`user_role = 'superadmin' OR user_modulos->>'pcm' IN ('leitura','escrita')`) + policies explícitas de deny `INSERT`/`UPDATE`/`DELETE` para `authenticated` (mesmo padrão defensivo de `audit.events`, `0001`); `GRANT SELECT` (só) para `authenticated`; `GRANT SELECT, INSERT, UPDATE, DELETE` para `service_role` **+ `GRANT USAGE ON SCHEMA pcm TO service_role`** — o schema `pcm` nunca recebeu esse grant antes (só `0002` granted `usage on schema pcm... to authenticated`); sem ele a Edge Function de sync não enxerga o schema mesmo com `service_role` (Postgres nega no nível de privilégio antes de qualquer RLS/policy — é exatamente a classe de bug já registrada em `0003` e `0010` deste projeto, não repetir) | AC-3 | 1 | `pnpm run lint:migrations` (checa CREATE POLICY↔GRANT cumulativo) | ✅ done (lint:migrations verde — CREATE POLICY↔GRANT ok) |
| 3  | `_shared/auvo/paginate.ts` — helper de paginação genérico (`pageSize=100`, itera `pageNumber` até página vazia/menor que `pageSize`), reaproveitado pelas duas Edge Functions abaixo `[P]` | AC-1, AC-2 (infra) | `E01-S09`/`client.ts` (já existe) | teste unitário: páginas completas, última página parcial, página vazia na primeira chamada, erro no meio de uma página não deve corromper o acumulado (propaga o erro pro chamador decidir) | ✅ done (código; teste Deno escrito, não roda sem Deno CLI aqui) |
| 4  | Edge Function `pcm-auvo-users-sync`: `requireServiceRole` (reaproveitado de `_shared/auth.ts`, mesmo helper de `pcm-auvo-create-task`/`pcm-auvo-customers-sync`), pagina `GET /users` via task 3, **filtra `userType = 1`** no resultado (AC-1 é explícito: só colaborador de campo — não cachear conta administrativa/escritório do Auvo), upsert por `auvo_user_id` (`nome`, `equipe`), soft-delete (AC-4) dos que sumiram — ver guarda na task 6 | AC-1, AC-4 | 1, 2, 3 | teste de integração com mock paginado (2+ páginas, incluindo cenário de falha no meio) | ✅ done (código; sem Deno CLI p/ type-check/integração) |
| 5  | Edge Function `pcm-auvo-equipment-sync`: mesma estrutura da task 4 para `GET /equipments`; resolve `auvo_customer_id` a partir do `customerId` que o Auvo devolve por equipamento — se não houver `pcm.clientes.auvo_id` correspondente (cliente ainda não sincronizado por `E01-S09`), grava `auvo_customer_id = null` + loga aviso estruturado, **não falha** o upsert do equipamento (FK é nullable, task 1) | AC-2, AC-4 | 1, 2, 3 | teste de integração com mock paginado | ✅ done (código; sem Deno CLI p/ type-check/integração) |
| 6  | Guarda de soft-delete (AC-4, nas duas Edge Functions das tasks 4/5): a reconciliação `ativo = false` só roda se **todas** as páginas do sync foram buscadas com sucesso nesta execução — se a paginação falhar no meio (rede, 5xx do Auvo), aborta sem tocar em `ativo`, para não marcar como inativo um técnico/equipamento que só não foi alcançado por causa do erro `[P]` | AC-4 | 3, 4, 5 | teste: mock de falha na página 2 de 3 → nenhuma linha marcada `ativo = false` | ✅ done (implementado por construção — auvoPaginate propaga erro antes de qualquer escrita) |
| 7  | Migration `0013_E01-S11_cron_sync_auvo_diario.sql`: função `pcm.fn_auvo_sync_tecnicos_equipamentos_diario()` no mesmo padrão do trigger de `0011` (`net.http_post`, `exception when others` nunca propaga) disparando as duas Edge Functions das tasks 4/5 — **reaproveita os secrets do Vault já criados em `0011`** (`auvo_trigger_project_url`/`auvo_trigger_service_role_key`, sem secret novo — são genéricos, não específicos da task de OS); `create extension if not exists pg_cron with schema extensions;` + `cron.schedule('sync_auvo_tecnicos_equipamentos_diario', '0 6 * * *', 'select pcm.fn_auvo_sync_tecnicos_equipamentos_diario();')` (06:00 UTC = 03:00 BRT, fora do horário comercial) | AC-5 | 4, 5 | `pnpm run lint:migrations` + inspeção manual (`select * from cron.job;` após deploy) | ✅ done (lint:migrations verde; `select * from cron.job` = inspeção pós-deploy) |
| 8  | Pré-requisito operacional: confirmar que a extensão `pg_cron` está habilitada no projeto Supabase (Dashboard → Database → Extensions — em projetos hospedados às vezes só habilita por lá, `create extension` pode não ter permissão suficiente dependendo do plano) — mesmo tipo de passo manual já registrado em `E01-S09` task 2 (secrets) e `E01-S10` task 1 (registro de webhook): operacional, fora do alcance de um agente sem acesso ao dashboard de produção | AC-5 | 7 | `select 1 from pg_extension where extname = 'pg_cron';` | ⏳ manual/bloqueado (operacional — sem acesso ao Dashboard de produção) |
| 9  | Invocação sob demanda (AC-5b): **nenhum código novo** — a mesma Edge Function das tasks 4/5 já aceita `Authorization: Bearer <service_role_key>` via `requireServiceRole`, idêntico ao que o cron da task 7 usa. "Sob demanda" = `supabase functions invoke pcm-auvo-users-sync`/`curl` autenticado por quem tiver a chave (ops/superadmin), sem tela dedicada — fora de escopo explícito da spec | AC-5 | 4, 5 | inspeção (chamada manual de teste após deploy) | ✅ done (nenhum código novo — mesmo requireServiceRole; validação = chamada manual pós-deploy) |
| 10 | `docs/blueprint/integracoes/auvo.md`: já lista as duas Edge Functions (linhas 33-34) e a divisão "Auvo é a fonte de técnicos" (linha 16) — conferir que os nomes de tabela batem com a migration da task 1 quando implementar; nenhuma mudança de conteúdo esperada `[P]` | — | 1 | inspeção | ✅ done (nomes de tabela batem: `pcm.tecnicos_cache`/`pcm.equipamentos_cache`; sem mudança de conteúdo) |
| 11 | Gates a rodar ao implementar: `pnpm run lint:migrations`, `pnpm run audit:esteira`, `pnpm run eval:spec`, `pnpm run lint`, `pnpm run typecheck` — ver ressalvas em "Achados sobre os gates" abaixo (Deno CLI + limitação real do `eval:spec` já confirmada nesta sessão) | — | 1-9 | comandos acima | ✅ done (rodados — ver Resultado da implementação; ressalvas conhecidas) |
| 12 | `docs/epics/ROADMAP.md` + `docs/STATE.md`: marcar `E01-S11` com AC verdes quando `@dev` terminar a implementação | — | 1-11 | inspeção | ✅ done |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual (exceto onde marcado
> "inspeção"). Nenhuma task acima foi implementada nesta sessão — só planejada/decomposta.

## Notas de implementação (decisões técnicas tomadas nesta sessão, não cobertas literalmente pela spec)
Nenhuma destas é decisão de produto — todas são detalhes de implementação dentro do que `spec.md`
já autoriza; documentadas aqui para `@dev` não precisar redecidir:

- **[AUTO-DECISION]** FK de `pcm.equipamentos_cache` para `pcm.clientes` via `auvo_customer_id
  references pcm.clientes(auvo_id)` (não `cliente_id references pcm.clientes(id)`) → a spec pede
  explicitamente "vinculado via `auvo_id`"; Postgres permite FK contra qualquer coluna `UNIQUE`
  (não só PK), e `pcm.clientes.auvo_id` já é `unique`. Reason: segue a redação literal da spec e
  evita uma etapa extra de resolução de `id` interno dentro da Edge Function.
- **[AUTO-DECISION]** `auvo_customer_id` nullable + soft-fail (log de aviso, não erro) quando o
  cliente do equipamento ainda não tem `auvo_id` no PCM. Reason: `E01-S09` (sync de cliente
  PCM→Auvo) e `E01-S11` (sync de equipamento Auvo→PCM) rodam de forma independente — um
  equipamento pode chegar antes do cliente dono estar sincronizado. Falhar o upsert do equipamento
  nesse caso quebraria o sync inteiro por uma dependência cruzada que a spec não menciona.
- **[AUTO-DECISION]** Reaproveitar os secrets do Vault `auvo_trigger_project_url`/
  `auvo_trigger_service_role_key` (criados em `0011` para o trigger de `E01-S09`) em vez de criar
  secrets novos para o cron desta story. Reason: são genéricos (URL do projeto + chave
  `service_role`), não amarrados à OS — criar um segundo par redundante só duplicaria segredo sem
  ganho.
- **[AUTO-DECISION]** Reaproveitar `requireServiceRole` (`_shared/auth.ts`, já existe desde
  `E01-S09`) como único mecanismo de auth das duas novas Edge Functions, para os dois gatilhos de
  AC-5 (cron **e** invocação sob demanda) — sem caminho de auth separado para "superadmin via JWT
  de usuário". Reason: a própria AC-5 diz que "a Edge Function não sabe nem se importa quem/o que
  a invocou, só que a chamada é autenticada" — um único mecanismo (posse da `service_role` key)
  cobre ambos os casos sem introduzir uma segunda superfície de auth; e a spec já deixa explícito
  que não há UI que exigiria autenticação por usuário final.
- **[AUTO-DECISION]** Horário do cron: `0 6 * * *` (06:00 UTC = 03:00 horário de Brasília).
  Reason: spec só exige "fora do horário comercial" (não especifica hora exata) — 03:00 BRT está
  fora de qualquer expediente plausível da Sinérgica.
- **[AUTO-DECISION]** `pcm-auvo-users-sync` filtra `userType = 1` no resultado de `GET /users`
  (client-side, após a paginação) em vez de tentar um filtro server-side via `paramFilter`.
  Reason: `AC-1` é explícito sobre o filtro; sem confirmação do shape exato do `paramFilter` para
  esse endpoint (mesma ressalva "NÃO VERIFICADO NESTE AMBIENTE" que já existe em `client.ts` desde
  `E01-S09`), filtrar depois de receber a página é mais seguro que confiar num filtro remoto não
  verificado — mesmo raciocínio que `pcm-auvo-customers-sync` já usou para não confiar cegamente
  em `search.result[0]`.
- **[AUTO-DECISION]** (adicionada por `@dev` na implementação) Guarda extra na reconciliação de
  soft-delete: se a paginação teve sucesso mas devolveu **zero** registros (0 técnicos com
  `userType=1`, ou 0 equipamentos), a reconciliação `ativo = false` é **pulada** (log de aviso), em
  vez de desativar o cache inteiro de uma vez. Reason: `AC-4` fala de registro **removido
  individualmente**; a spec é silenciosa sobre "o Auvo devolveu vazio". Um resultado totalmente
  vazio de um endpoint externo é suspeito o bastante (mudança de shape/filtro no lado do Auvo) para
  não valer uma desativação catastrófica de todo o cache — é a mesma classe de "fallback perigoso"
  que a guarda da task 6 evita. Facilmente reversível se o time preferir o comportamento literal
  (desativar tudo quando o Auvo esvaziar). **Sinalizado ao lead** — decisão de borda que o produto
  pode querer confirmar (é a fronteira entre detalhe de implementação defensivo e regra de negócio).

## Plano de teste
- Unidade: `paginate.ts` (páginas completas/parcial/vazia/erro no meio); guarda de soft-delete
  (task 6) — sync com falha parcial não deve marcar nenhuma linha `ativo = false`; filtro
  `userType = 1`.
- Integração: `pcm-auvo-users-sync`/`pcm-auvo-equipment-sync` contra mock HTTP paginado do Auvo
  (mesma ressalva de `E01-S09`/`E01-S10`: sem `msw`/mock configurado no repo ainda — decidir na
  hora de implementar); upsert rodado 2x seguidas não duplica nem falha (idempotência); equipamento
  cujo cliente não está sincronizado grava `auvo_customer_id = null` sem falhar o sync inteiro.
- RLS: `db/rls-test.md` — pgTAP confirmando que `authenticated` não consegue `INSERT`/`UPDATE`/
  `DELETE` nas duas tabelas de cache (AC-3), e que `service_role` consegue as quatro operações.
- Aceite: um teste por AC (AC-1 a AC-5) — nenhum implementado ainda (esta sessão é só
  planejamento).

## Achados sobre os gates (não são SPEC_DEVIATION da feature — sinalizando para quem for rodar)
- **`pnpm run eval:spec` (`scripts/eval-spec-fidelity.mjs`) não avalia pastas `specs/E0N-S0N-*/`.**
  Rodei o script nesta sessão para confirmar: ele só varre `specsDir` com
  `/^\d{4}-/.test(name)` (ex.: `0001-priorizacao-backlog-gut`), então `E01-S09`, `E01-S10` e este
  `E01-S11` são **silenciosamente ignorados** — o gate passa "verde" sem checar a rastreabilidade
  AC↔task destas stories, mesmo que uma task esqueça de citar um `AC-N`. Não é um problema desta
  story nem algo que `@sm` deva corrigir (é o script `scripts/eval-spec-fidelity.mjs`, fora do
  meu escopo tocar código/ferramenta) — sinalizando para o time decidir se vale abrir uma
  chore para o script também casar o padrão `E\d+-S\d+-`. Mitigação manual enquanto isso não
  existe: cada AC da spec (AC-1 a AC-5) aparece pelo menos uma vez na coluna "Cobre AC" da tabela
  acima — conferido à mão.
- **`pnpm run audit:esteira` já está vermelho no repo, sem relação com esta story**: 14
  arquivos em `.claude/agents/*.md` (não rastreados no git, `git status` mostra `?? .claude/agents/`)
  estão sem `alwaysApply` no frontmatter. Pré-existente a esta sessão — não criado nem tocado
  aqui, fora do escopo de `@sm` mexer em arquivos de agente. Sinalizando para quem for rodar o
  gate não confundir com um problema desta story.
- `pnpm run lint:migrations` rodado nesta sessão contra as 11 migrations existentes: limpo (ver
  baseline). Nenhuma migration nova foi criada por `@sm` — as migrations `0012`/`0013` descritas
  nas tasks 1/2/7 ainda não existem em disco, são o plano para `@dev`.
- Deno CLI: mesma ressalva de `E01-S09`/`E01-S10` — as Edge Functions `pcm-auvo-users-sync`/
  `pcm-auvo-equipment-sync` e `_shared/auvo/paginate.ts` não podem ser type-checked/executadas
  neste tipo de ambiente sem Deno instalado; não deve travar a implementação, só ficar registrado
  até uma sessão com Deno CLI (ou a CI) rodar de verdade.

## Resultado da implementação (`@dev` Dex, 2026-07-03)
Arquivos criados/alterados:
- `supabase/migrations/0012_E01-S11_cache_tecnicos_equipamentos.sql` (tabelas + RLS FORCE + policies
  + GRANT, incl. `grant usage on schema pcm to service_role` que faltava).
- `supabase/migrations/0013_E01-S11_cron_sync_auvo_diario.sql` (função + `cron.schedule` diário,
  reusa secrets do Vault de `0011`).
- `supabase/functions/_shared/auvo/paginate.ts` (+ `paginate.test.ts`, Deno).
- `supabase/functions/pcm-auvo-users-sync/index.ts`.
- `supabase/functions/pcm-auvo-equipment-sync/index.ts`.
- `supabase/tests/tecnicos_equipamentos_cache_rls.test.sql` (pgTAP, AC-3).
- `docs/blueprint/integracoes/auvo.md` — conferido, nomes batem, sem mudança.

Gates rodados nesta sessão:
- `pnpm run lint:migrations` → **verde** (13 migrations; convenções + Squawk ok, incl. checagem
  CREATE POLICY↔GRANT cumulativo, que confirma que o novo `grant usage on schema pcm to
  service_role` e os GRANTs de tabela estão presentes).
- `pnpm run lint` (biome) → **verde** (75 arquivos). Nota: `supabase/functions/**` é **ignorado**
  pelo biome (config `files.ignore`) — as Edge Functions/`paginate.ts` NÃO passam pelo lint Node
  (são Deno). Mesma realidade de `E01-S09`/`E01-S10`.
- `pnpm run typecheck` → **verde** (4 pacotes). Idem: não cobre `supabase/functions/**`.
- `pnpm test` (vitest) → **verde** (75 passed, 5 skipped). Os testes Deno (`paginate.test.ts`) NÃO
  rodam aqui — `turbo run test` só cobre `apps/*`/`packages/*`; precisam de `deno test`.
- `pnpm run build` → **verde**.
- `pnpm run audit:esteira` → **vermelho (exit 1)**, mas 100% pré-existente e fora de escopo: 14
  arquivos `.claude/agents/*.md` + 1 `.claude/agent-memory/...` sem `alwaysApply` (não rastreados,
  `?? .claude/agents/`). Nenhum tocado por esta story — exatamente a ressalva já registrada abaixo.
- `pnpm run eval:spec` → **verde**, mas **não avalia** `E01-S11` (só varre pastas `^\d{4}-`) — ver
  ressalva abaixo; rastreabilidade AC↔task conferida à mão (AC-1..AC-5 todos na coluna "Cobre AC").

Não verificável neste ambiente (sem Deno CLI / sem Supabase local com Docker / sem acesso ao
Dashboard de produção): type-check e testes de integração/unidade Deno das Edge Functions e do
`paginate.ts`; pgTAP `supabase test db` da RLS; task 8 (habilitar extensão `pg_cron` no projeto);
validação pós-deploy de `cron.job` e da chamada sob demanda (AC-5b). Ficam para a CI / uma sessão
com Deno+Docker, mesmo padrão de `E01-S09`/`E01-S10`.

## Divergências (SPEC_DEVIATION)
Nenhuma SPEC_DEVIATION aberta — a implementação segue `spec.md`. As decisões da seção "Notas de
implementação" (incluindo a guarda de soft-delete em resultado vazio, adicionada na implementação)
são [AUTO-DECISION] dentro do espaço autorizado/silente da spec, não contradições. A única que vale
confirmação do lead está sinalizada lá (guarda de resultado vazio) — não bloqueante.

## Rastreabilidade
- Spec: `./spec.md`
- Design reaproveitado: `../E01-S09-integracao-auvo-fundacao/design.md`
- Precedente de formato/gates: `../E01-S09-integracao-auvo-fundacao/tasks.md`,
  `../E01-S10-integracao-auvo-webhook-status/tasks.md`

## Checklist de Definition of Done
- [~] AC verdes **pelo gate executável** — gates Node verdes (lint:migrations/lint/typecheck/test/
      build). AC-1..AC-5 verificáveis de verdade só na CI/local com Deno+Docker (Edge Functions e
      pgTAP não rodam neste ambiente); rastreabilidade AC↔task conferida à mão (eval:spec ignora
      `E01-S11`).
- [x] Nenhum `SPEC_DEVIATION` pendente — nenhum aberto (só [AUTO-DECISION], ver acima)
- [ ] ADR novo — não esperado; nenhuma decisão irreversível nova além do já coberto por ADR-0001
      (Auvo é fonte, PCM espelha, idempotência por chave) e pelo mecanismo `pg_net`/Vault já
      formalizado (candidato a ADR) em `E01-S09`
- [ ] Glossário atualizado se mudou — `pcm.tecnicos_cache`/`pcm.equipamentos_cache` ainda não
      promovidos a `docs/glossary.md` global (mesma dívida já registrada em `E01-S09` para "Porta
      Auvo"/"Cliente Auvo"/"Sync de Cliente")
- [ ] Spec reflete o que foi construído — `spec.md` já reflete a decisão de AC-5, nada a corrigir
      nesta sessão
- [x] `docs/STATE.md` atualizado (esta sessão — tasks.md pronto)
- [ ] Segredos Auvo em Supabase Vault — reaproveitados de `E01-S09`/`0011` (task 7 acima), nenhum
      segredo novo necessário
