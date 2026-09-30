---
name: project-sinergica-os
description: "Decisões estruturais duráveis do Sinérgica SO. Estado corrente vive em docs/STATE.md, não aqui."
metadata:
  node_type: memory
  type: project
---

# Sinérgica SO — decisões duráveis

- Monorepo `apps/web` único com features por bounded context (não apps separados).
- PCM é origin of truth; Auvo é o braço de campo com `externalId` idempotente (ADR-0001).
- Detecção determinística de menção ao Zé antes do LLM (ADR-0002).
- Dinheiro em centavos (inteiro).
- PCM v2 legado (`pcm-sinergica-v2`) é só fonte de regras de negócio, não é reaproveitado.
- Workflow enxuto (E00-S25, 2026-09): Spec Kit no fluxo padrão, ROADMAP compacto, pre-push só nos afetados. Ver ADR de workflow em `docs/adr/`.

**Why:** memória anterior descrevia "casca concluída" (Mês 1) e ficou obsoleta; estado mutável não deve viver em memória.

**How to apply:** ao retomar, leia `docs/STATE.md` e a linha da story no ROADMAP (grep), não este arquivo.
