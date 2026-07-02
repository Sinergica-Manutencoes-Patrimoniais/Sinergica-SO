# Definition of Done — Padrão OS

> Uma feature/task **não está pronta por inspeção visual** — está pronta quando os **gates
> executáveis passam**. Este arquivo é o contrato de qualidade; o `@qa` valida por ele.

## Gates locais (Lefthook — automáticos, um só `lefthook.yml`)
Orquestrador: **Lefthook** (roda em paralelo). Um arquivo define os três momentos:
| Hook | Quem | O que verifica |
|------|------|----------------|
| `pre-commit` | `@dev` a cada commit | Biome nos arquivos staged (lint + format) — leve, roda sempre |
| `commit-msg` | `@dev` a cada commit | Conventional Commits (commitlint) |
| `pre-push` | `@devops` antes do push | **`ci:local` — espelho FIEL da CI** (toda a bateria, paralelo) |

> **Por que o peso está no pre-push, não no pre-commit:** o commit é frequente — encher de build
> ali vira cerimônia e atrapalha o ritmo (`ANTI-PADROES.md`). O push é o gatilho real do
> pipeline, então é ali que roda o espelho completo. `pnpm run ci:local` **é** `lefthook run
> pre-push` — o hook e o comando manual são a MESMA definição (`lefthook.yml`), não duas listas
> que divergem. Emergência: `git push --no-verify` (registre o porquê; o CI ainda cobra). Quem não
> é `@devops` nem chega ao push (hook de autoridade, `.claude/hooks/enforce-git-push-authority.sh`).

## Gates executáveis — um comando (`pnpm run ci:local`) roda quase todos
`ci:local` (= `lefthook run pre-push`) é o **espelho local do pipeline**: mesma bateria, em
paralelo. Se passar local, o CI deve passar (exceto `db-tests`, que exige Docker — ver abaixo).
Individualmente, para depurar:
| Gate | Comando | O que prova |
|------|---------|-------------|
| Esteira | `pnpm run audit:esteira` | frontmatter, links e specs íntegros |
| Rastreabilidade | `pnpm run eval:spec` | todo `AC` coberto por task; `SPEC_DEVIATION` contados |
| Diagramas | `node scripts/validate-mermaid.mjs` | blocos Mermaid válidos |
| Migrations (convenção) | `pnpm run lint:migrations` | DROP com reverso; **CREATE POLICY com GRANT** |
| Migrations (segurança) | Squawk (`.squawk.toml`, best-effort local) | migration sem lock/breaking-change perigoso |
| Lint/format | `pnpm run lint` | Biome sem finding |
| Type-check | `pnpm run typecheck` | TypeScript strict sem erro |
| Arquitetura (DDD) | `pnpm run arch:check` | `domain/`/`application/` não importam camada errada; sem ciclo |
| Build | `pnpm run build` | monorepo compila sem erro |
| Testes | `pnpm test` | cada `AC` da spec tem teste verde |
| RLS/pgTAP (job `db-tests`, CI) | `supabase start && supabase test db` | exige Docker — não entra no `ci:local`; rode manual se mexeu em migrations/RLS |

## Checklist (todo PR)
- [ ] Todos os `AC` da `spec.md` **verdes pelo gate** (`pnpm test`) — não por inspeção
- [ ] `pnpm run ci:local` **verde** localmente (espelho da CI)
- [ ] **CI real verde no PR:** `gh pr checks` sem vermelho e **sem check obrigatório pulado**
      (⚠️ o job `db-tests`, que exige Docker/banco, não pode ter sido silenciosamente pulado)
- [ ] **Revisão adversarial** (`/revisao-adversarial`) feita: tentou-se quebrar cada `AC` (borda,
      erro parcial, concorrência, buraco na spec, abuso); achados reproduzidos viraram teste e
      foram corrigidos. Gate verde prova o caminho feliz, não a correção.
- [ ] Nenhum `SPEC_DEVIATION` pendente sem resolução
- [ ] Decisões difíceis de reverter viraram **ADR** em `docs/adr/`
- [ ] **Segurança:** sem secret no client; input validado (Zod); JWT validado; RLS na tabela.
      Dívida aceita registrada em `docs/SECURITY_DEBT.md` (baseline em `seguranca/`)
- [ ] **Performance:** sem regressão de budget (`performance/README.md`) — query crítica indexada
      (sem `Seq Scan` em tabela grande), lista paginada, sem N+1
- [ ] **Observabilidade:** erro na borda em `problem+json` com `reqId`; log estruturado sem PII
- [ ] **Se feature de IA/LLM:** checks da trilha `ia/` (evals, prompt versionado, injection)
- [ ] Glossário atualizado se introduziu termo
- [ ] A `spec.md` reflete o que foi construído (ou a divergência está documentada)
- [ ] `docs/STATE.md` atualizado (próximo passo, decisões, bloqueios)
- [ ] `git push` / PR feitos por **@devops** (ver `AGENTS.md`)

## Web Vitals (quando houver frontend)
- LCP < 2.5s · INP < 200ms · CLS < 0.1
