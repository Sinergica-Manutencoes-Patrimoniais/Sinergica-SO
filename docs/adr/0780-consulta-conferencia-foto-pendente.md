---
name: "docs-adr-0780-consulta-conferencia-foto-pendente-md"
description: "Documento Sinérgica SO: ADR 0780 — Consulta de conferência da ingestão pendente"
alwaysApply: false
---

# ADR 0780 — Consulta de conferência da ingestão pendente

PCM com capacidade atual `cadastro.aprovar` no Cliente pode consultar a confirmação e a primeira observação auditada de um request do mesmo Cliente e lote/linha. A projeção retorna somente request, confirmação e retrato temporal da observação; não inclui caminho, digest ou bytes. Ausência histórica de objeto não implica ausência atual nem término de upload. A consulta não altera reserva, foto, Storage ou Auvo e usa gate já desligado da ingestão. A interface conserva a tentativa e não interpreta conferência como conclusão.

O identificador da tentativa pode ser comunicado ao PCM; na mesma linha e Cliente, outro usuário autorizado pode consultá-lo sem possuir a sessão original. A consulta não descarta objetos nem decide que um upload cessou. Pendência definitiva ainda exige procedimento operacional aprovado.
