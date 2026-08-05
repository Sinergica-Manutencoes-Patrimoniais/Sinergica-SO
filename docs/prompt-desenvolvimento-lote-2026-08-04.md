# Prompt de desenvolvimento — lote de specs 2026-08-04

> Model-agnostic: serve pra Claude **ou** Codex. Foi feito pra retomada entre sessões — quando um
> modelo encerra a sessão, o outro continua de onde parou (ver "Retomada entre sessões").
> Cole o bloco abaixo numa sessão nova, já na branch `feat/planejamento-lote-2026-08-04`.

---

```text
# Tarefa: implementar as specs pendentes do Sinérgica-SO

Você é @dev/@devops no Sinérgica-SO (monorepo React 19 + Vite + TS + Supabase), Padrão SO v3 (SDD).
Idioma PT-BR, termos técnicos em inglês. Este prompt vale pra Claude ou Codex — é model-agnostic.

## Antes de qualquer código (obrigatório)
1. Leia: CLAUDE.md, docs/STATE.md, docs/epics/ROADMAP.md, docs/PROJECT.md, AGENTS.md.
   - Se você é Codex: leia também .codex/agents/dev.md e .codex/agents/devops.md.
2. Você está na branch `feat/planejamento-lote-2026-08-04`. NÃO faça push em `main`.
3. Specs em specs/ (spec.md + tasks.md). Fonte da verdade = spec.md; os AC (Given/When/Then) são o
   contrato e o oráculo de teste. Spec ambígua → pare e pergunte, não adivinhe.

## Retomada entre sessões (Claude ↔ Codex) — LEIA SEMPRE
Sessão pode encerrar a qualquer momento. Pra continuar sem perder trabalho:

DESCOBRIR ONDE PAROU (nesta ordem):
1. docs/STATE.md — o bloco mais recente tem "Próximo passo"; é a memória viva de handoff.
2. docs/epics/ROADMAP.md — coluna Owner/Status de cada story (quem pegou, o que já está verde).
3. specs/<story>/tasks.md — a tabela de tasks tem uma coluna Status (todo/done) por task.
4. `git log --oneline -30` — como é UM COMMIT POR TASK, o último commit de cada story diz
   exatamente o que já entrou; continue da primeira task ainda "todo".

REGRA DE DURABILIDADE: um commit por task. Assim, uma sessão que para no meio de uma story deixa
as tasks concluídas já commitadas — a próxima sessão (Claude ou Codex) retoma da próxima task.

ANTES DE PARAR (fim de sessão / handoff): atualize docs/STATE.md com (a) o que concluiu, (b) a
PRÓXIMA task exata a fazer, (c) bloqueios/decisões pendentes; e commite esse STATE. No Claude, use
a skill /handoff; no Codex, edite docs/STATE.md direto seguindo AGENTS.md. Nunca pare sem deixar o
STATE apontando o próximo passo.

MARQUE O OWNER da story no ROADMAP ao pegá-la; não pegue uma story com owner de outra sessão ativa.

## Escopo — specs pendentes (status "Especificado — não implementado" no ROADMAP)
Lote 2026-08-04: E00-S13; E01-S120,S121,S122,S123,S124,S125,S126,S127,S129,S130,S131,S132,S133,
S134,S135,S136,S137,S138; E02-S27.
Depois, siga o ROADMAP para as demais pendências dos outros épicos (E01 ⏳, E04, E09, E02), por
prioridade/dependência. NÃO reimplemente o que já está feito (8a=S94, 8b=S95, 8d, 8e).

## Ordem sugerida (respeite dependências)
1. Nav/trivial: E01-S132 (reorg nav), E01-S122 (tooltips).
2. Fixes: E01-S124 (mover Chamado→Corretiva converte OS), E01-S130 (assessment ao vivo),
   E01-S120 (Auvo id na tela), E01-S123 (drill-down saúde Auvo).
3. Config/segredo (reusam padrão Vault E00-S12): E00-S13 (OpenRouter), E02-S27 (Evolution).
4. Features: E01-S121, S126, S133, S134, S136, S137, S138, S131, S127.
5. Cross-cutting/maior: E01-S135 (relatório cliente + Portal E09, RLS por condomínio).
6. ARQUITETURAL — E01-S125 (abertura OS Auvo sob demanda): ADR-0015 já ACEITO, mas a task 0 é
   BLOQUEANTE — audite TODOS os produtores de task Auvo (trigger fn_auvo_create_task_on_planejamento,
   pcm-ze-agent, webhook, portal) antes de remover o trigger. Não remova sem migrar quem dependia.
7. E01-S129 é story de release/QA (checklist), não código — rode por último.

## Ciclo por story
- Marque o owner da story no ROADMAP antes de codar.
- Uma task por vez (tasks.md), UM COMMIT POR TASK.
- Arquitetura hexagonal por feature: interfaces → application → domain ← infrastructure.
  domain/ sem I/O nem framework. Features de domínios diferentes não se importam (compartilhe via packages/).
- Linguagem ubíqua: docs/glossary.md; termo novo → glossário no mesmo PR.
- Divergência da spec → `// SPEC_DEVIATION: <motivo>` no código e em tasks.md.
- Ao terminar a story: atualize tasks.md (Status), ROADMAP.md (AC verdes) e docs/STATE.md.

## Commits (commitlint é estrito)
- Formato: `type(EXX-SYY): descrição` — scope OBRIGATÓRIO no formato E0N-S0N; subject em minúscula
  (sentence-case). Ex.: `feat(E01-S124): converte chamado em OS ao mover pra corretiva`.
- Termine a mensagem com:
  Co-Authored-By: <seu identificador de modelo>

## Gates (uma task só é "done" pelo comando, não por inspeção)
- Rode `pnpm run ci:local` (espelho da CI): typecheck, vitest, biome, build, arch:check,
  lint:migrations, audit:esteira, eval:spec — todos verdes.
- Neste sandbox: use `./node_modules/.bin/biome` direto (npx/pnpm lint dá OOM).
- Após mudar código: `graphify update .` (mantém o grafo).
- PLAYWRIGHT é obrigatório antes de marcar "done" (CI desabilitada, sem rede de segurança). Rode
  localmente contra o dev server (localhost). NUNCA teste contra a URL de produção Netlify.

## Supabase — deploy (projeto ref: nudannsrfvjggoergvyn)
Ambiente SEM Docker e SEM Deno CLI. Logo: pgTAP/db-tests só na CI (não local — não pule, confirme
verde no PR); Edge Functions (Deno) não dá pra type-check local — valide na CI/produção.

Migrations:
- Nome: `NNNN_EXX-SYY_descricao.sql`, sequência crescente sem pular (última é 0164 → próxima 0165).
- Tabela nova: RLS FORCE, deny-by-default, claims JWT do hook (user_role/user_modulos), grants mínimos.
  service_role nunca no client.
- Segredos: nunca em tabela comum — Supabase Vault (padrão E00-S12, config.fn_definir_segredo_integracao;
  leitura via vault.decrypted_secrets em security definer).
- Aplicar: `supabase db push --linked`. Verificar: `supabase migration list --linked`.
- Lint: `pnpm run lint:migrations` (Squawk). Drop/rename intencional → comentário `-- squawk-ignore <rule>`.

Edge Functions:
- Deploy: `supabase functions deploy <nome> --use-api` (sem Docker).
- Smoke pós-deploy: função responde ACTIVE — 401 (sem auth/HMAC) é esperado; 404 = não subiu.
- Toda função invocada tem que existir (gate scripts/check-edge-functions.mjs pega órfã).

## Segurança (OS-grade, obrigatório)
RLS FORCE em toda tabela · schemas por domínio · audit append-only · secrets em Vault · webhooks com
HMAC · service_role só no servidor. Dívida → docs/SECURITY_DEBT.md.

## Fluxo devops
Trabalhe nesta branch. Ao concluir um bloco coerente, abra PR via `gh pr create` (nunca push direto
em main). Merge só após PR verde (`gh pr checks` sem check obrigatório pulado — db-tests/pgTAP exige
Docker na CI, não pode ter sido silenciosamente pulado).

Comece: leia STATE.md + ROADMAP, descubra onde a última sessão parou (seção "Retomada"), e me diga
o plano de ataque (ordem + próxima story/task) antes de codar.
```
