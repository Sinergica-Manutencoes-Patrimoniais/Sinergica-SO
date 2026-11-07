---
name: "docs-adr-0540-recuperacao-parcela-adicional-md"
description: "Documento Sinérgica SO: ADR-0540 — recuperação de parcela por pedido"
alwaysApply: false
---

# ADR-0540 — recuperação de parcela por pedido

Status: proposto; não aplicado nem homologado. Consulta por Cliente, item e requestId exige autor original e capacidade atual; lê o comando financeiro canônico e a alocação vinculada. Gate específico permite recuperação independente do gate de novas parcelas. Ausência não prova que uma operação em trânsito falhou ou não será concluída; a consulta não repete comando nem altera dados. Segurança, acesso revogado, concorrência e recuperação em trânsito exigem testes antes de habilitar.
