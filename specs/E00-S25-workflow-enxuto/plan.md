# Plano — Enxugar workflow do Sinérgica SO (Spec Kit + Triviaiox fora do caminho padrão)

## Context
Desenvolvimento lento e caro em token. No Atendimento (PR #86, `chore/workflow-enxuto`) o ScafoldOS foi trocado por Spec Kit + CI mínima + constitution, com bom resultado. Aqui o objetivo é o mesmo ganho **sem reescrever o legado** (254 specs, 268 linhas de ROADMAP) e sem perder continuidade multi-sessão, docs, specs boas, segurança OS-grade e performance.

### Diagnóstico (medido)
| Custo | Onde | Tamanho |
|---|---|---|
| ROADMAP carregado em todo início de sessão | `docs/epics/ROADMAP.md` | 278 KB (~75–80k tokens, ~90% do contexto inicial) |
| Ciclo obrigatório de 6 personas | `.claude/commands/TRIVIAIOX/agents/*.md` | 290–560 linhas cada (~5–8k tokens por ativação), HALT a cada ativação |
| pre-push = CI completa | `lefthook.yml` / `ci:local` | ~20 comandos, 246 test files, `tsc` duas vezes, 9 scans `check-*.mjs` separados |
| Hooks por tool call sem efeito | `.claude/settings.json`, `.codex/hooks.json` | `graphify hook-guard` em todo Bash/Read/Glob (`graphify-out/` nunca foi gerado); `check-story.mjs` em todo Edit (só lembra) |
| Skill obrigatória inexistente | `/revisao-adversarial` | exigida por CLAUDE.md, AGENTS.md, DoD, `validar`, `revisar-pr`; não existe, agente improvisa |
| tasks.md com código inline | ex. `specs/E01-S155/tasks.md` | 8,7 KB em 38 linhas (SQL, assinaturas) |
| Burocracia de fechamento | 2–3 commits docs por story; ROADMAP+STATE editados em toda story |

## Cenário recomendado: híbrido
**Spec Kit passa a ser o fluxo padrão de story nova; Triviaiox vira ferramenta opcional.** Legado fica intacto.

- **Por que não migrar total (igual Atendimento):** ROADMAP com owner é o mecanismo de paralelismo entre sessões; 254 specs `E0N-S0N` + migrations `NNNN_E0N-S0N_*` + commitlint com escopo dependem do ID. Trocar tudo = muito token reescrevendo, pouco ganho extra.
- **Por que não só enxugar Triviaiox:** Spec Kit já refina bem (preferência do PO) e carrega só quando invocado.

Fluxo novo (vai no `CLAUDE.md`):
- **Trivial / bug:** branch → código (+teste que falha antes) → PR. Sem spec (ou `specs/quick/`).
- **Feature:** marcar owner no ROADMAP → `speckit-specify` → `speckit-plan` → `speckit-tasks` → `speckit-implement`, pasta `specs/E0N-S0N-nome/`.
- **Arquitetural** (schema com dado em produção, integração externa, novo bounded context): igual feature + ADR + `/revisao-adversarial`.
- Personas `@architect`, `@security`, `@data-engineer` etc. **só sob demanda**; sem HALT/greeting em fluxo normal.

Mantido (não negociável): IDs `E0N-S0N` em pasta, commit e migration; ROADMAP com owner; RLS FORCE + pgTAP em CI (`db-tests`); gitleaks; `pnpm audit`; Squawk; `audit.*` append-only; Vault; HMAC; `service_role` fora do client; TanStack Query; regra de dependência DDD; SPEC_DEVIATION; ADR para decisão irreversível; branch + PR (nunca push em main).

## Fases
Cada fase = sessão nova, commit próprio. Mecânicas em Sonnet; Opus só na revisão da constitution e do diff final.

### F0 — Preparação (coordenar com a outra sessão)
- Esperar a outra sessão mergear `feat/onda1-componente-posicao-categoria` (F1–F2 mexem em `CLAUDE.md`, `ROADMAP.md`, `lefthook.yml`, zona de conflito).
- `git tag pre-enxugamento` em `main`; branch `chore/E00-SNN-workflow-enxuto`; abrir story no ROADMAP (ID próximo livre de E00) com owner.

### F1 — Contexto sempre-carregado (maior ganho: ~80k para ~15k tokens)
- **ROADMAP:** script único `scripts/roadmap-compactar.mjs` (mecânico, zero reescrita manual):
  - copia o arquivo atual verbatim para `docs/epics/historico/ROADMAP-ate-2026-09.md`;
  - gera `ROADMAP.md` compacto: só colunas `ID | título | owner | status | spec`, linha ≤ 200 chars; stories concluídas de épicos fechados saem da tabela (ficam no histórico).
  - Regra nova: detalhe de escopo vive no `spec.md`, nunca na linha do ROADMAP.
- **CLAUDE.md** (179 linhas) → ≤ ~80 linhas: contexto, fluxo novo, regras de segurança em 1 bloco, ponteiros. Carregamento inicial: `CLAUDE.md` + `docs/STATE.md` + grep da linha própria no ROADMAP (não o arquivo inteiro). `docs/PROJECT.md` vira sob demanda.
- `AGENTS.md` (Codex): mesmo conteúdo via import/link para não duplicar.
- Remover seção graphify de `CLAUDE.md`/`AGENTS.md` e os hooks `graphify hook-guard` / `hook-check` (grafo inexistente). Se quiser graphify depois, gerar o grafo e religar.
- Remover hook `check-story.mjs` do Edit/Write (não bloqueia, só custa processo).
- Trocar `.claude/hooks/enforce-git-push-authority.sh` (Node em todo Bash) por permissão `ask` em `Bash(git push:*)` no `settings.json`; mesmo efeito, zero processo.
- Memórias: atualizar `.claude/memory/feedback-processo-stories.md` para o fluxo novo; corrigir `project-sinergica-os.md` (desatualizada).

### F2 — Gates (pre-push só afetados)
- `lefthook.yml` pre-push: `biome` nos arquivos alterados + `turbo run typecheck test --filter=...[origin/main]` + `gitleaks` (se instalado). Nada mais.
- `ci:local` continua existindo (completo, sob demanda, antes de PR sensível).
- Mover para **só CI** (job `qualidade`, já roda lá): `audit:esteira`, `eval:spec`, `validate-mermaid`, `arch:check`, `build`, 9 `check-*.mjs`.
- Performance da CI: juntar os 9 `check-*.mjs` em `scripts/check-design.mjs` com uma varredura só (reaproveitar regex de cada um); tirar o `tsc --noEmit` duplicado do script `build` de `apps/web` (typecheck já é job próprio).
- `audit-esteira` / `eval-spec-fidelity`: aceitar formato Spec Kit (`plan.md` em vez de `design.md`) e só validar specs novas ou tocadas; `eval:spec` não carregar o repo inteiro numa string.
- `db-tests`, Squawk, `lint:migrations`, `deno test`, `pnpm audit`: **inalterados**.
- `Definition-of-Done.md` 14 itens → ~6: CI verde (incluindo `db-tests` não pulado), AC com teste, sem SPEC_DEVIATION pendente, ADR se irreversível, linha do ROADMAP atualizada, adversarial só no tier arquitetural.

### F3 — Spec Kit
- Instalar igual Atendimento (copiar `.specify/` + skills core `speckit-specify|plan|tasks|implement|constitution` para `.claude/skills/` e `.agents/skills/`); não instalar os opcionais (clarify, analyze, checklist…). Anotar: `specify integration upgrade` reinstala os opcionais.
- **Nome da pasta `E0N-S0N-nome`:** verificar no `create-new-feature` script do Spec Kit se aceita nome customizado; se não, patch mínimo no script (ou `SPECIFY_FEATURE`). Ponto a validar na fase, não inventar.
- **Constitution** (`.specify/memory/constitution.md`, ~50–70 linhas): portar do `CLAUDE.md` + `seguranca/os-grade.md` as regras "Mantido" acima. O "Constitution Check" do `speckit-plan` vira o gate de segurança/arquitetura embutido; sem skill extra.
- Templates: spec com AC Given/When/Then (Spec Kit já usa); tasks = 1 linha por task + referência de AC, **sem SQL/assinatura inline** (detalhe vai em `plan.md`/`data-model.md`).
- Criar `.claude/skills/revisao-adversarial/SKILL.md` curto (≤ 40 linhas): borda, erro parcial, concorrência, RLS/abuso, buraco na spec; achado vira teste.
- Skills antigas: arquivar `nova-feature`, `validar`, `revisar-pr`, `auditar` em `docs/_arquivo/skills/`; manter `clarificar` e `handoff`. `specs/_templates/` + `scripts/nova-story.mjs`: manter só para registrar linha no ROADMAP + `.current-story` (sem gerar product/design/domain).

### F4 — Agentes e docs de processo
- `AGENTS.md`: tirar ciclo obrigatório de 6 agentes; personas listadas como opcionais. **Não deletar** `.claude/commands/TRIVIAIOX/`, `.codex/agents/`, `.triviaiox-core/` (custo zero quando não invocados; evita churn).
- `ANTI-PADROES.md`, `PADRAO-DE-QUALIDADE.md`: resumir o essencial na constitution; originais para `docs/_arquivo/`.
- Fechamento de story: 1 commit docs no máximo (spec+tasks entram junto do primeiro `feat`); `STATE.md` só via `/handoff` ao pausar, não em toda story.
- **ADR novo** substituindo a decisão de framework anterior (Atendimento não fez: lacuna a não repetir).
- Regra de governança na constitution: "regra que atrapalha mais do que protege é removida, não contornada".

## Arquivos críticos
`CLAUDE.md`, `AGENTS.md`, `docs/epics/ROADMAP.md`, `.claude/settings.json`, `.codex/hooks.json`, `lefthook.yml`, `package.json`, `apps/web/package.json`, `.github/workflows/ci.yml`, `Definition-of-Done.md`, `scripts/audit-esteira*`, `scripts/eval-spec-fidelity*`, `scripts/check-*.mjs`, `scripts/nova-story.mjs`, `.claude/memory/*.md`, novos `.specify/memory/constitution.md`, `scripts/roadmap-compactar.mjs`, `docs/adr/NNNN-workflow-enxuto.md`.
Referência pronta: `/Users/lucasazevedo/GitHub/Atendimento/` — `AGENTS.md`, `.specify/`, `.claude/skills/speckit-*`, `docs/_plano-workflow/`, `lefthook.yml`.

## Verificação
- Contexto inicial: soma de bytes dos arquivos sempre-carregados ≤ 20 KB (hoje ~300 KB).
- `time lefthook run pre-push` num diff pequeno: antes vs depois.
- PR da mudança com `gh pr checks` verde, incluindo `db-tests` (pgTAP/RLS) executado.
- `pnpm run ci:local` completo ainda verde.
- Piloto: próxima story pequena feita no fluxo novo; comparar tokens/tempo com S156 (`/cost` ou caveman-stats).
- Rollback: tag `pre-enxugamento`.
