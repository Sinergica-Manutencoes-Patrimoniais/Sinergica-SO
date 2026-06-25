---
name: revisar-pr
description: Use no code review para checar conformidade com o Padrão OS — rastreabilidade spec↔código, gates verdes, segurança do perfil e ausência de SPEC_DEVIATION pendente. Agente: @qa. Acione com /revisar-pr.
---

# Skill: Revisar PR (gate de conformidade SDD)

Revisa um PR contra o Padrão OS. **Dono:** `@qa`. Foco em conformidade, não em estilo (estilo é
do Biome).

## Checklist de review
- [ ] PR linka a `spec.md` e lista os `AC` cobertos.
- [ ] **Rastreabilidade:** cada `AC` entregue tem task em `tasks.md` e teste correspondente.
- [ ] **Gates verdes** no CI (testes, typecheck, lint, `eval:spec`, `audit:esteira`).
- [ ] Nada **fora de escopo** da spec foi implementado.
- [ ] Nenhum `SPEC_DEVIATION` pendente sem resolução (corrigir código OU atualizar spec+ADR).
- [ ] Decisão difícil de reverter tem **ADR**.
- [ ] **Segurança do perfil:** sem secret no client, input validado, RLS na tabela; dívida em
      `SECURITY_DEBT.md`. Em OS/PII/financeiro/integração → `@security` aprovou.
- [ ] (IA/LLM) trilha `ia/` cumprida.
- [ ] `docs/STATE.md` e glossário atualizados quando aplicável.

## Saída
Comente os achados ligados ao item do checklist. Veredito: **aprovar** / **pedir ajustes**.
Lembrete: merge e push são do `@devops`.
