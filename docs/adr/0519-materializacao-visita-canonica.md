---
name: "docs-adr-0519-materializacao-visita-canonica-md"
description: "Documento Sinérgica SO: ADR-0519 — Materialização de Visita com identidade canônica"
alwaysApply: false
---

# ADR-0519 — Materialização de Visita com identidade canônica

Status: preparada, gate fechado, não aplicada nem homologada. O caminho 0744 usa 0455 e 0742 na mesma transação, reutiliza somente a mesma identidade de Plano/Rotina lógica/alvo/série/semana e registra uso por versão. O trigger opt-in requer token transacional privado para impedir inserções diretas enquanto o gate está ativo. Nenhum registro anterior é alterado, nenhuma OS ou tarefa é criada.

Feriados declarados não constituem fonte completa; alterações de Visita, fontes e vigências exigem reconciliação. Integração com legado/retorno permanece bloqueada; testes de concorrência, locks, triggers e revisão adversarial obrigatórios. Gate desligado mantém comportamento anterior.
