---
name: "docs-adr-0260-reclassificacao-grupo-quantitativo-md"
description: "Documento Sinérgica SO: ADR-0260 — Reclassificação explícita de Grupo Quantitativo"
alwaysApply: false
---

# ADR-0260 — Reclassificação explícita de Grupo Quantitativo

O comando existente de edição já altera categoria e Sistema com revisão e auditoria. Para permitir uma operação mais restrita, preparamos comando separado que altera apenas esses vínculos, preservando Local, quantidade, características e identidade, e registra motivo obrigatório e retratos antes/depois. A categoria deve existir e o Sistema, quando informado, deve estar ativo no mesmo Cliente. A operação exige autorização, revisão atual e request id idempotente.

O novo comando permanece privado e seu gate desligado. A interface existente de edição integral não é substituída nem sua autorização alterada. Revisão de concorrência, validação de efeitos colaterais e testes são pré-requisitos de ativação.
