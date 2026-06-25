---
name: validar
description: Use antes de abrir/aprovar PR para validar a feature pela Definition of Done — roda os gates executáveis (testes por AC, typecheck, lint, eval de rastreabilidade, auditoria) e checa SPEC_DEVIATION. Agente: @qa. Acione com /validar.
---

# Skill: Validar (UAT local / gate de qualidade)

Valida a feature **pelos gates executáveis**, não por inspeção. **Dono:** `@qa`.

## Passos
1. Rode os gates (ver `Definition-of-Done.md`):
   - `npm test` — cada `AC` da spec tem teste verde
   - `npm run typecheck` · `npm run lint`
   - `npm run eval:spec` — todo `AC` coberto por task; conta `SPEC_DEVIATION`
   - `npm run audit:esteira` — frontmatter/links/specs íntegros
   - `node scripts/validate-mermaid.mjs` se houver diagrama
2. Confira a `tasks.md`: toda task `done` tem gate que de fato passa.
3. **Segurança:** rode o checklist do perfil (`seguranca/baseline-minimo.md`; em OS,
   `os-grade.md`). Dívida aceita está em `docs/SECURITY_DEBT.md`?
4. **Se feature de IA/LLM:** evals passam no limiar; caso adversarial sem falha (`ia/`).
5. Cruze a saída com a `spec.md`: AC implementados batem com o contrato; nada de "fora de escopo".

## Resultado (gate)
Emita um veredito: **PASS** (tudo verde) · **CONCERNS** (passa, mas com ressalva registrada) ·
**FAIL** (gate vermelho — não segue para PR). Em FAIL, liste o que falhou e devolva ao `@dev`.
