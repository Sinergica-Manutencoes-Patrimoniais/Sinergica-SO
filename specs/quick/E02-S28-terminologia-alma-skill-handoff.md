---
name: E02-S28-terminologia-alma-skill-handoff
description: Fix de terminologia — Alma/Skill/Handoff já existem (promptSistema/Especialista/palavrasTransferencia), só faltava expor no vocabulário certo na UI.
alwaysApply: false
---

# Quick fix — E02-S28 · terminologia Alma/Skill/Handoff no Atendimento

**Pedido (Lucas, 2026-08-07):** trazer pra tela de Atendimento "Skills, Alma do agente e Mensagem
de handoff para humano, e textos que ativaram o handoff".

**Achado (investigação antes de codar):** os três conceitos já existem, com CRUD completo, desde
E02-S06/S13/S14 — só não usam esse vocabulário na UI:

| Pedido do Lucas | Já existe como | Onde |
|---|---|---|
| Alma do agente | `PersonaItem.promptSistema` — campo "Prompt base" | `ConfigIaForm.tsx` |
| Skills | `EspecialistaItem` (nome + "quando chamar") — seção "Especialistas" | `OperacaoTab.tsx` |
| Textos que ativaram handoff | `palavrasTransferencia: string[]` — seção "Palavras que transferem" | `OperacaoTab.tsx` |

**Fix:** renomeia só o rótulo/subtítulo visível ao usuário — `promptSistema`/`Especialista`/
`palavrasTransferencia` continuam os mesmos nomes de campo/tabela no código e no banco (renomear
isso seria migration + refactor sem ganho nenhum pro pedido real). 3 entradas novas em
`docs/glossary.md` (Alma, Handoff, Skill) documentam o mapeamento termo-UI ↔ nome-de-código.

**Mensagem de handoff configurável e log de handoffs reais** — perguntados e descartados
explicitamente pelo Lucas nesta sessão (queria só a exposição do que já existe).

## Fora de escopo
- Renomear campo/tabela no banco ou nos tipos TypeScript.
- Mensagem de handoff configurável (texto enviado ao transferir) — não pedido.
- Log/auditoria de handoffs reais disparados — não pedido.
