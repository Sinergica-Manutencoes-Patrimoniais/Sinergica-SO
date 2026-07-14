---
name: handoff
description: Use ao pausar ou retomar trabalho para manter continuidade entre sessões — atualiza/lê docs/STATE.md com onde paramos, próximo passo e bloqueios. Acione com /handoff.
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
Leia `docs/STATE.md` + a `spec.md` da feature ativa (contexto base do `CLAUDE.md`) e continue do
"próximo passo". Não re-derive o que já está registrado. Precisa de contexto mais antigo? Veja
`docs/state-historico/INDEX.md` antes de vasculhar às cegas.

## Rotação (mantenha o arquivo pequeno — ele é `alwaysApply: true`, carrega em toda sessão)
`docs/STATE.md` é sessão-mais-recente + bloqueios abertos, não um diário completo. Ao pausar, se
o arquivo passar de ~2 entradas de sessão ou ~250 linhas:
1. Mova as entradas mais antigas (tudo exceto a mais recente) para
   `docs/state-historico/<data-inicial>-a-<data-final>.md` (frontmatter com `alwaysApply: false`
   — não pode entrar no carregamento automático).
2. Adicione 1 linha nova em `docs/state-historico/INDEX.md`: período, link, resumo de 1 frase.
3. Ao mover "Bloqueios", carregue só os que ainda estão claramente abertos pra seção nova — não
   copie a lista antiga inteira às cegas (itens resolvidos viram ruído; itens incertos, confira
   antes ou deixe só no arquivo histórico).
4. Rotação é sobre **tirar sessão antiga do carregamento automático**, não sobre encurtar a
   entrada de hoje — detalhe técnico na entrada mais recente vale a pena e não deve ser cortado
   por brevidade (confirmado com Lucas, 2026-07-13). Só rotacione o que já é passado.

> STATE é volátil; decisão durável vai para ADR, não para o STATE.
