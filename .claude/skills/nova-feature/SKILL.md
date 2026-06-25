---
name: nova-feature
description: Use para abrir uma nova feature no Padrão OS. Decide o tier (trivial/pequeno/arquitetural), cria specs/NNNN-<nome>/ a partir dos templates e conduz o preenchimento pelos gates (product → design → domain → spec → tasks). Agentes: @sm conduz, @dev implementa. Acione com /nova-feature.
---

# Skill: Nova feature (loop SDD)

Abre e conduz uma feature pela esteira. A **spec é o contrato**; preencha na ordem dos gates e
pare em cada um para review. Siga o `CLAUDE.md` e o `ANTI-PADROES.md`. **Dono:** `@sm` (cria
`tasks.md`), `@dev` (implementa). Não invente — ver "Verificação de conhecimento" no `CLAUDE.md`.

## Fase 1 — Identidade
1. Próximo número: maior `NNNN` em `specs/` + 1, com 4 dígitos (ex.: `0002`).
2. Nome curto em kebab-case → pasta `specs/NNNN-<nome>/`.

## Fase 2 — Decidir o tier (gate)
Pergunte: **"isso introduz decisão difícil de reverter ou nova fronteira de domínio?"**

| Resposta | Tier | Artefatos a criar |
|----------|------|-------------------|
| Não, trivial (≤3 arquivos) | **Trivial** | só o PR — ou `specs/quick/NNN-slug/` para deixar rastro |
| Não, feature isolada | **Pequeno** | `spec.md` + `tasks.md` |
| Sim | **Arquitetural** | `product.md` + `design.md` + `domain.md` + `spec.md` + `tasks.md` + ADR |

Na dúvida, **suba** de tier. **Não** crie artefato a mais do que o tier pede (`ANTI-PADROES.md`).
Copie os templates de `specs/_templates/` para a pasta. Referência preenchida:
`specs/0001-calculo-comissao/`.

## Fase 3 — Preencher de cima pra baixo (pare em cada gate)
1. **`product.md`** (arquitetural) — problema, para quem, métrica, goals/non-goals.
2. **`design.md`** (arquitetural) — solução + 5 eixos + alternativas/trade-offs/riscos. Decisão
   difícil de reverter → ADR. Ambiguidade ramificada? rode `/clarificar`.
3. **`domain.md`** (se há domínio novo) — bounded context, linguagem ubíqua, agregados. Atualize
   `docs/glossary.md`.
4. **`spec.md`** (sempre) — AC em Given/When/Then, casos de borda, **fora de escopo**. Gate: cada
   AC é testável e não-ambíguo? Se vago, rode `/clarificar`. Regra multifator → use a matriz de decisão.
5. **`tasks.md`** (sempre) — cada task mapeia `AC-N` (token por extenso) e tem **gate executável**.
6. **Se feature de IA/LLM:** acione a trilha `ia/` (evals, prompt versionado, injection) com `@prompt-engineer`.

## Fase 4 — Implementar (por @dev)
- Uma task por vez, **um commit por task**, na ordem de dependência.
- Task só é `done` quando o **gate passa** (comando), não por inspeção.
- Ao terminar, rode `/validar` e atualize `docs/STATE.md`.
- `git push`/PR são do `@devops` (ver `AGENTS.md`).
