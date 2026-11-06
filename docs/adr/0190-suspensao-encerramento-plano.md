---
name: "docs-adr-0190-suspensao-encerramento-plano-md"
description: "Documento Sinérgica SO: ADR-0190 — Suspensão e encerramento protegidos do Plano"
alwaysApply: false
---

# ADR-0190 — Suspensão e encerramento protegidos do Plano

Status: proposta, não homologada.

O gestor com concessão individual `plano.gerir` pode suspender ou encerrar Plano aprovado/ativo por comando transacional, motivo, revisão, requestId e vigência local do dia. A decisão é imutável, não muda versões, ocorrências ou OS e não aciona Auvo. A geração preparada S166 consulta estado do Plano; demais geradores ainda exigem integração. O comando fica revogado e sob gate fechado.

Agendamento futuro, datas retroativas, retomada com decisão sobre vencidos, geração legada/PMOC, concorrência, conflitos de timezone, autorização efetiva e revisão adversarial permanecem pendentes. Por segurança a proposta atual recusa vigência fora do dia corrente e não deve ser ativada como AC-7 completo.
