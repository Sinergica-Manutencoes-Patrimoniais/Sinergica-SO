---
name: "docs-adr-1041-historico-alertas-reprogramacao-md"
description: "Documento Sinérgica SO: ADR-1041 — Histórico de alertas declarados na Visita"
alwaysApply: false
---

# ADR-1041 — Histórico de alertas declarados na Visita

Status: preparado, sem aplicação, concessão ou testes.

O histórico mostra, por Visita e Cliente, a data-base declarada, alertas informados, justificativa e responsável da reprogramação mediada. A leitura usa permissão de confirmação da Visita, gate específico e paginação por requestId. A ordem não é cronológica e os registros são declarações humanas: não comprovam capacidade, vencimento ou autenticidade de fontes. A consulta não altera a Visita nem o Auvo.

Validar isolamento entre Clientes, revogação, concorrência, privacidade e retenção de justificativas, desempenho da paginação e revisão adversarial antes de habilitar. Não apresentar uma página vazia como prova de ausência de outros alertas ou transições anteriores.
