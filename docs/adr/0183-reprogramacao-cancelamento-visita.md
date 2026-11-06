---
name: "docs-adr-0183-reprogramacao-cancelamento-visita-md"
description: "Documento Sinérgica SO: ADR-0183 — Transições locais protegidas de Visita"
alwaysApply: false
---

# ADR-0183 — Transições locais protegidas de Visita

Status: proposta, não homologada.

Comando privado e fechado reprograma ou cancela Visita com revisão esperada, autorização por ação, requestId e motivo, gravando histórico imutável e auditoria. Reprogramação retorna Visita a `planejada` (ou conserva `rascunho`) e incrementa revisão, invalidando confirmação vinculada à revisão anterior. Cancelamento preserva histórico e vínculos; não altera OS ou tarefas remotas. Não é permitida transição de Visita enviada ou com OS cujo vínculo ou estado de integração sugira efeito remoto, até reconciliação com S168.

`visita.cancelar` foi preparada no catálogo pela ADR-0187, sem concessão automática; precisa ser configurada antes de qualquer ativação. Remanejamento de OS, retorno à Demanda, integração T−24, cancelamento remoto, contratos de corrida, testes e revisão adversarial seguem pendentes. Nenhuma operação externa é disparada.
