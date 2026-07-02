# Definition of Done — Padrão OS

> Uma feature/task **não está pronta por inspeção visual** — está pronta quando os **gates
> executáveis passam**. Este arquivo é o contrato de qualidade; o `@qa` valida por ele.

## Gates locais (Husky — automáticos, sem precisar rodar manualmente)
| Hook | Quem | O que verifica |
|------|------|----------------|
| `pre-commit` | `@dev` a cada commit | Biome nos arquivos staged (lint + format) |
| `commit-msg` | `@dev` a cada commit | Conventional Commits obrigatório |
| `pre-push` | `@devops` antes do push | typecheck + testes — último check antes do CI/deploy |

## Gates executáveis (rode antes de abrir/aprovar PR)
| Gate | Comando | O que prova |
|------|---------|-------------|
| Testes (AC) | `npm test` (`vitest run`) | cada `AC` da spec tem teste verde |
| Type-check | `npm run typecheck` | TypeScript strict sem erro |
| Lint/format | `npm run lint` | Biome sem finding |
| Rastreabilidade | `npm run eval:spec` | todo `AC` coberto por task; `SPEC_DEVIATION` contados |
| Esteira | `npm run audit:esteira` | frontmatter, links e specs íntegros |
| Diagramas (se houver Mermaid) | `node scripts/validate-mermaid.mjs` | blocos Mermaid válidos |
| Arquitetura (DDD) | `npm run arch:check` | `domain/`/`application/` não importam camada errada; sem ciclo |

## Checklist (todo PR)
- [ ] Todos os `AC` da `spec.md` **verdes pelo gate** (`npm test`) — não por inspeção
- [ ] `npm run typecheck`, `npm run lint`, `npm run eval:spec`, `npm run audit:esteira` passam
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
