<!-- Padrão OS — PR conforme a esteira SDD. Preencha e marque o que se aplica. -->

## O que muda
<Uma frase. Link para a spec: `specs/NNNN-*/`.>

## Tier
- [ ] Trivial · [ ] Pequeno · [ ] Arquitetural

## Rastreabilidade
- Spec: `specs/NNNN-.../spec.md`
- AC cobertos por esta entrega: <AC-1, AC-2, …>
- ADRs (se houver decisão difícil de reverter): <ADR-NNNN>

## Definition of Done (gates)
- [ ] `npm test` verde (cada AC tem teste)
- [ ] `npm run typecheck` · `npm run lint` ok
- [ ] `npm run eval:spec` · `npm run audit:esteira` ok
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] Segurança: sem secret no client, input validado, RLS na tabela; dívida em `SECURITY_DEBT.md`
- [ ] (Se IA/LLM) checks da trilha `ia/`
- [ ] `docs/STATE.md` atualizado

> `git push` e merge: **@devops** (ver `AGENTS.md`).
