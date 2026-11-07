---
name: "docs-adr-0470-dados-invalidos-fila-md"
description: "Documento Sinérgica SO: ADR-0470 — diagnóstico segregado de inconsistências da fila"
alwaysApply: false
---

# ADR-0470 — diagnóstico segregado de inconsistências da fila

Status: proposto; gate fechado, sem aplicação ou homologação. A consulta identifica apenas inconsistências de metadados em itens cujo Cliente pode ser comprovado por Sistema ou Equipamento. Linhas sem vínculo comprovado não são atribuídas a nenhum Cliente e exigem auditoria administrativa separada. A amostra é limitada e identifica truncamento. Falha de leitura deve permanecer erro na interface, nunca lista vazia; a operação não altera fila, não entrega payload e não autoriza reenvio. Revisar escopo, desempenho e capacidade antes de ativar.
