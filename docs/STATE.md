---
name: STATE
description: Memória de trabalho volátil — onde paramos, próximo passo, bloqueios.
alwaysApply: true
---

# STATE — Memória viva do projeto

> Memória de trabalho **entre sessões** (humanos e agentes). É **volátil**: atualizada o tempo
> todo. Diferente do **ADR** (decisão durável e imutável). Decisão estrutural → ADR; estado do
> trabalho → aqui. Atualize ao **pausar/encerrar**; leia ao **retomar**. Use a skill `/handoff`.

**Última atualização:** 2026-07-03 por @dev (3 stories em volume: E00-S09 (fundação de grupos),
E00-S10 (UI de grupos, em cima de E00-S09) e E01-S09 (fundação Auvo) — implementadas via agentes
`@dev` em worktrees paralelos, cada uma revisada como `@qa` antes de aceitar. PR #9 (E00-S09+S10)
e PR #10 (E01-S09) abertos; `db-tests` real no CI achou mais 2 bugs em E00-S09, corrigidos)

## Status geral
**Fase:** Casca concluída (E00-S04) + E00-S05 (Auth/RBAC) + E00-S06 (sync Padrão OS) + E00-S07
(hardening v3.4.0) + E00-S08 (rename de papéis) **mergeadas em `main` e aplicadas em produção**
(PRs #4/#5/#6/#7/#8). E00-S09 (grupos/permissões por módulo, fundação) implementada na branch
`feat/E00-S09-grupos-permissao-modulo` — parte foi rascunhada por outro agente (Codex) na mesma
branch antes desta sessão retomar; revisei tudo linha a linha (não confiar às cegas) e achei um
bug de segurança real (ver Decisões). Repo `Sinergica-Manutencoes-Patrimoniais/Sinergica-SO`.
Supabase **reprovisionado** (`nudannsrfvjggoergvyn`) — schemas, migrations, GRANTs, Custom Access
Token Hook e Data API expostos, confirmados via query direta/Management API.
**Gates locais rodados nesta sessão:** `lint:migrations` ✅ (9 migrations, Squawk limpo) ·
`audit:esteira` ✅ · `lint` (Biome) ✅ · `typecheck` ✅. **Não rodado:** `supabase test db`
(pgTAP) — Docker indisponível localmente nesta sessão; job `db-tests` do CI é o gate real,
**checar antes do merge**.

E00-S10 (UI administrativa — grupos, usuários, gating de sidebar) implementada em
`apps/web/src/features/config/` (domain/application/infrastructure/pages/components, seguindo o
mesmo padrão hexagonal de `features/auth/`), `apps/web/src/app/permissoes-context.tsx`
(`PermissoesProvider`/`usePermissoes`) e alterações em `HomePage.tsx`/`App.tsx`. **Gates rodados
e verdes nesta sessão:** `pnpm run lint`, `pnpm run typecheck`, `pnpm test` (75 passed, 5
skipped), `pnpm run build`, `pnpm run arch:check`, `node scripts/audit-esteira.mjs`. **Não
verificado:** teste manual em browser (login real por papel, criar/editar grupo e usuário,
confirmar sidebar filtrada) — sem ambiente Supabase logável nesta sessão; e o teste de integração
do novo adapter (`supabase-config-adapter.integration.test.ts`, escrito mas self-skip sem
`SUPABASE_LOCAL`/Docker). Ambos ficam como validação humana/@qa pendente antes do merge. Detalhes
de escopo (o que ficou de fora e por quê) em
`specs/E00-S10-grupos-permissao-ui/tasks.md` → "Decisões de escopo". O gap de GRANT/DELETE em
`config.grupos`/`grupo_modulos` achado durante esta implementação já está corrigido (migration
`0010`, ver "Entrega em volume" abaixo).

## Incidentes resolvidos nesta sessão
- **Login do superadmin "credenciais inválidas"**: investigado — a senha/usuário estão corretos
  (confirmado testando `POST /auth/v1/token?grant_type=password` direto na API, retornou token
  válido). A causa real é o deploy do Netlify estar quebrado (ver item abaixo) — o site em
  produção está servindo um build antigo/stale, possivelmente com env vars do Supabase antigo.
  **Ação do usuário**: depois que o Netlify voltar a buildar (fix já commitado), confirmar em
  Site settings → Environment variables que `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` apontam
  pro projeto atual (`nudannsrfvjggoergvyn`) — não consigo checar isso eu mesmo (Netlify CLI
  local não está autenticado).
- **Build do Netlify falhando** (`core.hooksPath is set locally to '.husky/_'`, Lefthook recusa
  instalar): `scripts/prepare-hooks.mjs` novo (pula `lefthook install` quando `CI`/`NETLIFY`/
  `GITHUB_ACTIONS` estão setados — hooks de git não servem pra nada em CI/build) +
  `package.json` `prepare` aponta pra ele. Revisado, correto e seguro (CI já roda os gates
  direto, nunca dependeu dos hooks instalados).
- **GitHub Actions `deploy.yml`/`sync-secrets.yml` falhando** ("Invalid access token format"):
  o secret `SUPABASE_ACCESS_TOKEN` no GitHub não estava no formato `sbp_...` esperado pelo
  Supabase CLI, mesmo o `.env.local` local estando correto — re-sincronizado via `gh secret set`
  para descartar corrupção do upload em lote de sessão anterior. `sync-secrets.yml` teve o
  gatilho automático (`push`) desligado por precaução até confirmar que o secret está certo —
  rodar manualmente (`workflow_dispatch`) antes de reativar o automático.

## Entrega em volume — 3 stories via agentes paralelos (2026-07-03)
Usuário pediu para não parar em E00-S09/E00-S10 — "veja o que tem planejado e pendente e use todo
o fluxo de desenvolvimento com os agentes triviaiox", visando um PR com volume grande de entrega.
Rodei 2 agentes `@dev` em paralelo, cada um num worktree git isolado (evita conflito de working
tree), depois revisei cada resultado como `@qa` (ler o diff inteiro, não só o relatório do
agente) antes de aceitar:

- **E00-S10** (UI de grupos/permissões), worktree em cima da branch de E00-S09 — telas de Grupos
  e Usuários, `PermissoesProvider` novo, sidebar/tab-bar/dashboard filtrados por permissão
  real (capacidade que não existia antes: hoje todo mundo via todos os 10 módulos). 75 testes
  verdes, lint/typecheck/build/arch:check verdes.
- **E01-S09** (fundação Auvo), worktree/branch nova baseada em `main` — cliente HTTP Auvo
  compartilhado, `pcm-auvo-customers-sync`/`pcm-auvo-create-task` (Edge Functions), trigger
  `pg_net` assíncrono em `pcm.ordens_servico`. Gates de código (lint:migrations/audit-esteira/
  eval-spec-fidelity) verdes; Edge Functions (Deno) não puderam ser type-checked nem executadas
  nesta sessão — sem Deno CLI disponível — e o formato exato de resposta da API Auvo (paramFilter,
  campos do envelope `result`) segue a descrição do design.md, não uma chamada real confirmada.

**2 bugs reais achados na revisão (nenhum dos dois pego pelos gates automáticos, só por leitura
cética do diff):**
1. `pcm-auvo-customers-sync`/`pcm-auvo-create-task`: fallback `?? search.result[0]` quando a
   busca por `externalId` não achava match — se o `paramFilter` do Auvo não filtrar como
   documentado (incerteza já sinalizada pelo próprio código), isso vincularia um cliente/task
   Auvo **errado** ao registro do PCM, silenciosamente. Corrigido: tratar "sem match" como
   "não encontrado", nunca pegar o primeiro resultado às cegas.
2. `config.grupos`/`config.grupo_modulos` (migration `0006`) nunca ganharam GRANT/policy de
   `DELETE` — só apareceu como bug real quando o agente de E00-S10 tentou consumir o backend
   (`editarGrupo()` precisa apagar+reinserir `grupo_modulos`; `criarGrupo()` faz rollback
   apagando o grupo se a gravação de permissões falhar). Corrigido em nova migration `0010`,
   rebaseada no topo de E00-S10 também.

**Mais 2 bugs achados só depois de abrir o PR #9 e o `db-tests` rodar de verdade no CI (Docker) —
nenhuma leitura estática, nem a revisão acima, pegou estes dois:**
3. `custom_access_token_hook`: `to_jsonb(v_papel)` quando `v_papel` é `NULL` em SQL (usuário sem
   perfil ativo/inativo) retorna `NULL` de SQL, não o literal JSON `null` (`to_jsonb()` é
   `STRICT`). `jsonb_set(..., NULL)` também é `STRICT` e retorna `NULL` — então **todo** o
   `v_claims` virava `NULL`, e a função inteira devolvia `event = NULL` em vez de um evento
   válido. Esse bug já existia desde a versão original do hook em `0002_E00-S05` (nunca pego
   porque nenhum teste chamava o hook de verdade para um usuário sem perfil/inativo) — ou seja,
   **já estava ao vivo em produção**. Corrigido com `coalesce(to_jsonb(v_papel), 'null'::jsonb)`.
4. Minha própria correção anterior (`current_user` → `session_user`, achado #1 acima) também
   estava errada: `session_user` não muda dentro de `SECURITY DEFINER` (certo), mas **também não
   muda com `SET LOCAL ROLE`** — e é assim que o PostgREST (e os testes pgTAP que simulam
   PostgREST) trocam de papel numa conexão já aberta. `session_user` continha sempre o role da
   conexão física (`postgres`), nunca `'authenticated'` — a guarda nunca disparava pra chamada de
   usuário comum. Achado pelo teste `"colaborador NAO resolve permissoes de outro usuario"`
   falhando de verdade no `db-tests`. Fix real: usar o claim padrão `role` do JWT
   (`auth.jwt() ->> 'role'`), não introspecção de role do Postgres — sempre presente num JWT real
   do PostgREST, ausente só quando não há contexto de request (chamada interna confiável).

**Nenhuma das 3 branches foi pusheada** — commits locais, aguardando decisão do usuário.

## Em andamento / próximo passo
- **Branch atual:** `feat/E00-S09-grupos-permissao-modulo` — usuário pediu um sistema de grupos
  de permissão por módulo (`superadmin`/`supervisor` criam grupos com leitura/escrita por
  módulo, atribuem usuário a grupo OU permissão individual, nunca os dois). Plano completo
  aprovado em plan mode (ver `docs/adr/0004-permissoes-por-modulo-grupos.md` e
  `specs/E00-S09-grupos-permissao-modulo/design.md`). Implementado: migrations `0006`-`0009`
  (schema `grupos`/`grupo_modulos`/`usuario_modulos`, resolver + hook JWT `user_modulos`, RLS de
  domínio por módulo, `feature_flags` superadmin-only), Edge Function
  `config-gerenciar-usuario` (cria usuário Auth + papel + permissão inicial numa chamada), pgTAP
  (28 asserções), ADR-0004, glossário, `db/rls.template.sql`, runbook. **E00-S10** (UI
  administrativa + gating de sidebar) é a próxima story, depende desta mergeada.
- **Revisão de segurança nesta sessão** (parte do trabalho tinha sido rascunhada por outro
  agente/Codex antes de eu retomar — usuário pediu revisão cética, não confiar às cegas):
  achei e corrigi um bug real — `config.resolver_permissoes_modulo` e
  `config.definir_permissao_usuario` usavam `current_user` pra reconhecer chamadas
  internas/privilegiadas, mas `current_user` dentro de uma função `SECURITY DEFINER` é sempre o
  **dono** da função, nunca quem chamou — a guarda nunca disparava, então qualquer
  `authenticated` conseguiria ler a permissão de qualquer usuário e reatribuir grupo/permissão
  de qualquer um. Corrigido pra `session_user`. Achei também `plan(34)` no pgTAP quando só havia
  28 asserções reais — corrigido. Nenhum dos dois bugs tinha sido pego porque o código nunca foi
  rodado de verdade (sem `supabase test db`) antes desta revisão.
- **Pendente (SPEC_DEVIATION, aguardando aprovação do usuário):** (1) criar de fato
  `.claude/skills/revisao-adversarial/SKILL.md` — o classificador de auto-modo bloqueou por ser
  arquivo novo de comportamento padrão, mandato geral não foi específico o suficiente; conteúdo
  já está pronto (copiado do scaffold, genérico, sem adaptação necessária). (2) `.gitleaks.toml`:
  não trouxe os `regexes` de allowlist extra do scaffold (EXAMPLE/your-api-key-here/
  VITE_SUPABASE_ANON_KEY) pelo mesmo motivo — só o path `.triviaiox/` foi adicionado (mesma
  categoria já aprovada de `.triviaiox-core/`).
- **Ainda manual (não coberto por CI/API):** login no browser para validar AC-1,2,4-7 do E00-S05
  fim a fim (agora com o superadmin já provisionado, dá pra testar de verdade); rotacionar o JWT
  secret legado do projeto Supabase (exposto sem querer num diagnóstico de sessão anterior) —
  ver Bloqueios.
- **Integração Auvo — estudo e specs concluídos** (pedido explícito do usuário: "veja aonde
  acoplar as informações do Auvo... gere as specs para desenvolver na sequência" — só estudo e
  planejamento, sem implementar código). Cruzei `docs/ARCHITECTURE.md`, ADR-0001,
  `docs/blueprint/integracoes/auvo.md` (já continha boa parte do design técnico) e o mapeamento
  completo da API Auvo (vault) com o schema real (`0001_E00-S00`, colunas `auvo_*` já existiam
  mas sem código nenhum as usando). Resultado: 3 stories novas no ROADMAP, todas tier
  arquitetural/pequeno, nenhuma implementada ainda —
  - `E01-S09` (**arquitetural**, tem `design.md`): fundação — cliente HTTP Auvo compartilhado,
    sync de cliente PCM→Auvo, criação de task Auvo quando OS entra em `planejamento`.
  - `E01-S10` (pequeno, consome o design de S09): webhook Auvo → atualização de status da OS
    (execução/conclusão/cancelamento) + gatilho de `pcm.pmoc_records`.
  - `E01-S11` (pequeno, consome o design de S09): sync Auvo→PCM de técnicos/equipes/equipamentos
    (cache read-only local, `pcm.tecnicos_cache`/`pcm.equipamentos_cache` — tabelas novas, ainda
    sem migration).
  Duas questões de produto ficaram em aberto (ver `E01-S09/design.md` → Questões em aberto):
  `taskTypeId` de `levantamento`/`emergencial` e mapeamento GUT→`priority` Auvo — bloqueiam só
  `AC-7` de `E01-S09`, não o resto. Próximo passo real: `@dev` pega `E01-S09` (tasks.md já tem
  13 tasks ordenadas) quando alguém marcar o owner.
- **Outros próximos passos possíveis** (não iniciados): `specs/0002` (abertura de chamado via
  Zé, spec já aprovada) ou telas de operação do PCM com dados reais.
- **Branches anteriores ainda pendentes de PR:** `docs/E01-S03-pmoc-spec` (PMOC spec + rename
  OS→SO + design system).

## Specs implementadas / artefatos prontos
| Spec | Status | Gate |
|------|--------|------|
| `0001-priorizacao-backlog-gut` | implementado, todos os ACs verdes | pnpm test |
| `0002-abertura-chamado-ze` | aprovado (aguarda implementação — Mês 2) | — |
| `E00-S03-dashboard-geral` | implementado, todos os ACs verdes | typecheck ✅ · lint ✅ |
| `E00-S04-sidebar-logo` | implementado, todos os ACs verdes | typecheck ✅ · lint ✅ |
| `E00-S05-autenticacao-autorizacao` | **implementado**, todos os ACs verdes (`db-tests` no CI) | typecheck ✅ · lint ✅ · test ✅ · `supabase test db` ✅ (29/29, via CI/Docker) |
| `E00-S06-sync-padrao-os-v3` | implementado, todos os ACs verdes | audit-esteira ✅ · eval:spec ✅ · typecheck ✅ · lint ✅ · test ✅ · arch:check ✅ |
| `E00-S07-hardening-padrao-v3.2.0` | **implementado e mergeado** (PR #7) | `pnpm run ci:local` ✅ (esteira/fidelidade/mermaid/migrations/lint/typecheck/arch/build/test) |
| `E00-S08-renomear-papeis-rbac` | implementado, usuário superadmin já provisionado | aguardando `ci:local`/PR |
| `specs/E01-S03-pmoc-schema/design.md` | design arquitetural criado (tier arquitetural) | revisão humana |
| `E01-S09-integracao-auvo-fundacao` | **código escrito** (cliente HTTP, task/priority-map, 2 Edge Functions, migration do trigger) — sem execução Deno/Postgres real neste ambiente, 6 SPEC_DEVIATION abertos (ver tasks.md) | `lint:migrations` ✅ · `audit-esteira` ✅ · `eval-spec-fidelity` ✅ · Deno type-check/testes: não executado (sem Deno CLI) |
| `E01-S10-integracao-auvo-webhook-status` | spec pronta, **implementação não iniciada** | depende de E01-S09 |
| `E01-S11-integracao-auvo-sync-tecnicos-equipamentos` | spec pronta, **implementação não iniciada** | depende de E01-S09 |

## Decisões recentes
- 2026-07-03: `E01-S09` (fundação Auvo) implementada em branch própria
  (`feat/E01-S09-integracao-auvo-fundacao`, a partir de `main`/`origin/main`, sem misturar com o
  trabalho paralelo de RBAC/grupos de outra sessão). Entregue: `_shared/auth.ts` ganhou
  `requireServiceRole` (chamada interna sistema→sistema via `SUPABASE_SERVICE_ROLE_KEY` como
  Bearer, comparação em tempo constante — `requireAuth`/`auth.getUser()` não serve para JWT de
  `service_role`, sem `sub`); `_shared/auvo/client.ts` (login cacheado 30min−120s, retry 401 1x,
  backoff 429 1x, log `X-Request-Id`+UTC); `_shared/auvo/task-type-map.ts` +
  `_shared/auvo/priority-map.ts` (+ testes Deno); Edge Functions `pcm-auvo-customers-sync` e
  `pcm-auvo-create-task`; migration `0011_E01-S09_trigger_auvo_planejamento.sql` (trigger
  `pg_net` assíncrono, `exception when others` nunca propaga, secrets via Vault
  `auvo_trigger_project_url`/`auvo_trigger_service_role_key`, não commitados). **Não construído**
  nesta sessão (fora do escopo explícito passado ao `@dev`): port `AuvoGatewayPort` na
  `application` da feature PCM e o `NullAuvoGateway` de `design.md` §Infra — as Edge Functions
  chamam o cliente Auvo direto. **6 SPEC_DEVIATION registrados** em `tasks.md` (porta não
  construída, coluna `clientes.endereco` inexistente, mapeamento de prioridade provisório,
  mecanismo de auth interna não estava em `design.md`, contrato exato da API Auvo não verificável
  neste ambiente, Deno CLI ausente — nenhum `.ts` foi type-checked/executado). Gates Node
  rodaram e passaram (`lint:migrations`, `audit-esteira`, `eval-spec-fidelity`); Squawk não
  instalado localmente (best-effort, CI é quem bloqueia de verdade). Sem git push (hook bloqueia
  por design) — trabalho commitado localmente na branch, aguardando push/PR por um devops humano
  ou sessão com permissão. Nota operacional: no início desta sessão, comandos de git exploratórios
  (`checkout`/`pull`/`branch -b`) foram rodados por engano no checkout compartilhado
  `~/Documents/GitHub/Sinergica/Sinergica-SO` (usado por outra sessão em paralelo) antes de eu
  perceber que meu trabalho real deveria ficar isolado no worktree
  `.claude/worktrees/agent-ae59de4e0ebc9048e` — nenhum comando destrutivo foi executado lá (só
  checkout/pull/criação de branch), mas vale registrar caso a outra sessão note o branch mudado.
- 2026-07-02: Papéis RBAC renomeados (E00-S08) — `admin→superadmin`, `escritorio→supervisor`,
  `tecnico→colaborador`; `cliente-sindico` inalterado (ator externo, fora da hierarquia de
  colaborador). Confirmado com o usuário: rename 1:1, mesma matriz de permissão de E00-S05, sem
  nova regra. Migration `0004` usa `alter policy` (não `drop`+`create`) nas ~19 policies de
  `0002_E00-S05_perfis_rbac.sql`, e remapeia dados existentes automaticamente (drop constraint →
  update → add constraint nova, nessa ordem — senão o remap violaria a constraint antiga).
  `docs/adr/0003` não foi editado (mecanismo JWT-claim/`config.usuarios` não mudou, só o
  vocabulário — não justifica ADR novo).
- 2026-07-02: Integração Auvo decomposta em 3 stories sequenciais em vez de uma só — `E01-S09`
  (fundação: cliente HTTP + sync cliente + criação de task, tier arquitetural, único com
  `design.md`) → `E01-S10` (webhook de status, consome o design de S09) → `E01-S11` (sync
  técnicos/equipamentos, direção invertida Auvo→PCM, consome o design de S09). Motivo: cada uma
  é entregável/testável isoladamente, e `docs/blueprint/integracoes/auvo.md` já apontava para 6
  Edge Functions com direções de dados diferentes — uma spec só ficaria grande demais para AC
  rastreáveis. Trigger de disparo escolhido para S09 é `pg_net` assíncrono (não bloqueante),
  não trigger síncrono — para a falha do Auvo nunca travar o *system of record* do PCM (ver
  `E01-S09/design.md` → Alternativas consideradas).
- 2026-07-02: Padrão OS evoluiu de v3.2.0 para v3.3.0/v3.3.1/v3.4.0 **durante** a story E00-S07 —
  husky+lint-staged+`ci-local.mjs` (task-runner caseiro) substituídos por **Lefthook**
  (`lefthook.yml` único, paralelo) + **Squawk** (segurança de migration: locks/breaking-change).
  `pnpm run ci:local` agora É `lefthook run pre-push` (hook e comando manual = mesma definição).
  Nova skill `/revisao-adversarial` (@qa+@security, tenta quebrar cada AC antes do PASS) — arquivo
  da skill em si não foi criado (bloqueado pelo classificador, ver Bloqueios), mas já está
  referenciado em `/validar`/`/revisar-pr`/DoD/matriz/AGENTS.md.
- 2026-07-02: Squawk achou 8 avisos reais (timeout settings, prefer-bigint) só em migrations
  `0001`/`0002`, já aplicadas em produção (nunca editadas) — excluídos em `.squawk.toml` com
  critério de reavaliação. Achado: `excluded_rules` precisa ser **top-level** no `.squawk.toml`,
  não dentro de `[default]` (como o próprio exemplo do scaffold sugeria) — silenciosamente
  ignorado se aninhado. `--assume-in-transaction` (real para Supabase) elimina os falsos
  positivos de "sem transação" sem precisar excluir a regra.
- 2026-07-02: "Padrão SO v2" (stale — a versão real é v3 há muito) corrigido em `CLAUDE.md`×2,
  `README.md`, `package.json` — mesma classe de bug que o próprio v3.3.1 do vault corrigiu.
- 2026-07-02: Custom Access Token Hook e schemas expostos (`pcm`/`atendimento`/`comercial`/
  `config`) registrados no projeto **hospedado** via Management API (`PATCH config/auth` e
  `PATCH postgrest`), não pelo Dashboard manualmente — mais rápido e auditável no histórico da
  conversa; confirmado por leitura de volta da config após aplicar.
- 2026-07-02: migration `0002_E00-S05_perfis_rbac.sql` não tinha `GRANT USAGE`/`SELECT`/`INSERT`/
  `UPDATE` para `authenticated` nos schemas de domínio — as RLS policies existiam mas o Postgres
  nega no nível de privilégio *antes* de avaliar RLS. Só apareceu rodando `supabase test db` de
  verdade (job `db-tests`, CI) — teria quebrado em produção do mesmo jeito. Grant adicionado à
  própria migration (ainda não aplicada a nenhum ambiente real).
- 2026-07-02: pgTAP não lança `42501` numa `UPDATE` filtrada pela `USING` da RLS — só em `INSERT`
  (violação de `WITH CHECK`). Teste corrigido para comparar valor antes/depois em vez de
  `throws_ok`.
- 2026-07-02: CI em Node 20 não roda `dependency-cruiser` 18 (exige `^22||^24||>=26`) — CI e
  `engines` do `package.json` raiz bumpados para Node ≥22.
- 2026-07-02: `vite` (via `@tailwindcss/vite`) tinha vuln HIGH (`GHSA-fx2h-pf6j-xcff`, sem patch na
  linha 5.x) — bump coordenado vite 6.4.3 + vitest 3.2.6 + `@vitejs/plugin-react` 4.7.0.
- 2026-07-02: `pnpm/action-setup@v4` recusa `with: version` quando o `package.json` já fixa
  `packageManager` — removido do `ci.yml` (só apareceu no 1º CI run real deste repo).
- 2026-07-02: `arch:check` (dependency-cruiser) roda sobre `apps/web/src` com `tsConfig.fileName`
  **absoluto** (`require("node:path").join(__dirname, ...)`) — passar caminho relativo causa bug
  de resolução do `extends` do `tsconfig.json` em monorepo (dependency-cruiser 18.0.0).
- 2026-07-02: RBAC via claim `user_role` no JWT (Custom Access Token Hook) + tabela `config.usuarios`, não subquery por policy — [ADR-0003](adr/0003-rbac-jwt-claim-config-usuarios.md).
- 2026-07-02: Provisionamento de usuário é manual em 2 passos (sem trigger automático em `auth.users` — não há como inferir o papel correto) — ver `runbooks/provisionar-usuario.md`.
- 2026-07-01: Renomeação produto "Sinérgica OS" → "Sinérgica SO" para eliminar ambiguidade com OS (Ordem de Serviço). "OS" = Ordem de Serviço; "SO" = Sistema Operacional.
- 2026-07-01: Tabelas PMOC (`pmoc_*`) vivem no schema `pcm` — PMOC é sub-módulo do PCM, não contexto autônomo.
- 2026-07-01: Checklists PMOC canônicos são constantes TypeScript em `packages/shared` (não no banco).
- 2026-07-01: OS Hub (E01-S07) decisão postergada — nova tabela vs refatoração da OS existente → design.md de E01-S07.
- 2026-06-25: PCM como origin of truth; Auvo recebe `externalId` idempotente — [ADR-0001](adr/0001-pcm-origin-truth-externalid.md)
- 2026-06-25: Detecção determinística de menção ao Zé antes de chamar o LLM — [ADR-0002](adr/0002-deteccao-deterministica-ze.md)
- 2026-06-25: Monorepo app único (`apps/web`) com features por bounded context — sem apps separados

## Bloqueios
- [x] ~~Git push bloqueado~~ ✅ Resolvido — novo repo `Sinergica-Manutencoes-Patrimoniais/Sinergica-SO`, Lucas é owner.
- [x] ~~Supabase não provisionado~~ ✅ Resolvido, depois **reprovisionado** — projeto atual:
      `nudannsrfvjggoergvyn.supabase.co`. `.env.local` atualizado (URL, publishable key,
      service_role, `SUPABASE_DB_PASSWORD`) — todos do projeto novo.
- [x] ~~E00-S05 precisa de Docker local~~ ✅ Resolvido — job `db-tests` no CI roda `supabase start`
      + `supabase test db` via Docker do runner do GitHub Actions. Achou e permitiu corrigir o bug
      real do GRANT ausente (ver Decisões). 29/29 pgTAP verdes.
- [x] ~~Migrations não aplicadas no projeto novo hospedado~~ ✅ Resolvido — GitHub Integration
      nativa ativada por Lucas (Settings → Integrations → GitHub, "Deploy to production" ON,
      production branch = `main`); aplicou `0001`+`0002` automaticamente. Confirmado por query
      direta em `supabase_migrations.schema_migrations` + existência dos 10 schemas + GRANTs
      corretos em `pcm.*` para `authenticated`.
- [x] ~~Ativar GitHub Integration nativa~~ ✅ Resolvido (mesmo item acima).
- [x] ~~Registro do Custom Access Token Hook em produção~~ ✅ Resolvido via Management API
      (`PATCH /v1/projects/{ref}/config/auth`) — `hook_custom_access_token_enabled: true`,
      apontando para `config.custom_access_token_hook`. Sem isso o JWT não carregava
      `user_role` e toda RLS negaria por padrão (AC-9) mesmo com login funcionando.
- [x] ~~Exposição dos schemas de domínio na Data API em produção~~ ✅ Resolvido via Management API
      (`PATCH /v1/projects/{ref}/postgrest`) — `db_schema` passou de `public,graphql_public` para
      incluir `pcm,atendimento,comercial,config`, espelhando `supabase/config.toml` local.
- [ ] **Rotacionar o JWT secret legado do projeto** — exposto sem querer no output de um comando
      de diagnóstico durante esta sessão (Dashboard → Settings → API → JWT Settings). Não é
      catastrófico (Supabase migrando desse esquema legado), mas é boa prática rotacionar algo que
      apareceu em texto puro numa conversa. Quem destrava: @devops/Lucas.
- [ ] Evolution API: instância existe na Cloudfy mas webhook não apontado para Supabase Edge Function ainda. Quem destrava: @devops/Lucas.
- [ ] **Criar `.claude/skills/revisao-adversarial/SKILL.md`** — bloqueado pelo classificador de
      auto-modo (arquivo novo de comportamento padrão; mandato geral "ajuste tudo" não foi
      específico o suficiente). Conteúdo pronto, é só aprovar. Quem destrava: Lucas, com um pedido
      direto ("crie a skill de revisão adversarial").
- [ ] **Decidir sobre os `regexes` de allowlist extra do `.gitleaks.toml`** (`EXAMPLE`,
      `your-api-key-here`, `VITE_SUPABASE_ANON_KEY`) do scaffold v3.2.0 — não trazidos por padrão
      (enfraqueceriam o gate de secret scanning sem pedido específico). Quem destrava: Lucas.
- [x] ~~Push/PR da branch `chore/E00-S07-hardening-padrao-v3.2.0`~~ ✅ Resolvido — PR #7 mergeado
      em `main`.
- [ ] **Definir `taskTypeId` Auvo de `levantamento`/`emergencial` e mapeamento GUT→`priority`**
      (decisão de produto do Fabrício) — bloqueia só `AC-7` de `E01-S09`, resto da story pode ser
      implementado sem isso. Ver `specs/E01-S09-integracao-auvo-fundacao/design.md` → Questões em
      aberto.
- [x] ~~`AUVO_API_KEY`/`AUVO_USER_TOKEN` só em `.env.local`~~ ✅ Resolvido — todas as vars de
      `.env.local` (Auvo, Supabase, Evolution API, OpenRouter, CORS) subidas como GitHub Actions
      secrets no repo (`gh secret list`, 14 secrets) a pedido do usuário ("vamos manter elas no
      github para você usar em tempo de deploy"). Novo workflow
      `.github/workflows/sync-secrets.yml` (gatilho: push em `supabase/functions/**` na `main`,
      ou `workflow_dispatch` manual) roda `supabase secrets set` para as que são runtime de Edge
      Function (Auvo, Evolution, OpenRouter, CORS — não as `SUPABASE_*`, que são reservadas/
      auto-injetadas pelo runtime). Falta só disparar o workflow uma vez quando `E01-S09` for
      implementada de verdade (hoje não há Edge Function nenhuma ainda, path do gatilho não
      dispara vazio).
- [ ] **Merge da PR de `E00-S08`** — só depois disso a migration `0004` aplica em produção via
      GitHub Integration nativa e a linha de `sinergicaengenharia@gmail.com` em
      `config.usuarios` remapeia de `admin` para `superadmin` automaticamente (o login já
      funciona hoje com acesso total, só o *label* do papel muda no merge). Quem destrava: Lucas.

## Ideias adiadas / backlog técnico
- Evals de laudo SPDA (comparação de saída LLM com laudos validados por engenheiro) → gatilho: primeira geração de laudo em produção
- Repriorização por IA no backlog GUT → gatilho: 3 meses de histórico de priorização
- Modo de Zé por número de técnico (DM direto) → gatilho: pedido explícito da Sinérgica

## Todos soltos
- [ ] Configurar CODEOWNERS (`.github/CODEOWNERS`) quando o time de desenvolvimento estiver definido
- [ ] Atualizar `docs/ENVIRONMENTS.md` quando URLs reais de staging/produção existirem
- [ ] Executar `pnpm run audit:deps` após provisionar e instalar dependências reais em CI
