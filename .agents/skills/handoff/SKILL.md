---
name: handoff
description: Use ao pausar ou retomar trabalho para manter continuidade entre sessões — atualiza/lê docs/STATE.md com onde paramos, próximo passo e bloqueios. Acione com /handoff.
alwaysApply: false
---

# Skill: Handoff (continuidade entre sessões)

Mantém a continuidade via `docs/STATE.md` (memória volátil). Use ao **pausar** e ao **retomar**.

## Ao pausar
Atualize `docs/STATE.md`:
- **Em andamento / próximo passo:** feature ativa (`specs/NNNN-*/`) e a **próxima ação concreta**.
- **Decisões recentes:** o que mudou; se difícil de reverter, vire ADR e linke.
- **Bloqueios:** o que trava, quem/como destrava.
- Carimbe data e autor.

## Ao retomar
Leia `docs/STATE.md` + a `spec.md` da feature ativa (contexto base do `AGENTS.md`) e continue do
"próximo passo". Não re-derive o que já está registrado.

> STATE é volátil; decisão durável vai para ADR, não para o STATE.
