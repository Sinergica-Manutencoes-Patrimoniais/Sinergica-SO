---
name: "docs-adr-0437-triagem-sincronizacao-funcionarios-md"
description: "Documento Sinérgica SO: ADR-0437 — triagem administrativa de sincronização de funcionários"
alwaysApply: false
---

# ADR-0437 — triagem administrativa de sincronização de funcionários

Status: proposto; não aplicado nem homologado. Funcionários são compartilhados entre Clientes: a projeção exige superadmin, capacidade de reconciliação no Cliente e vínculo vigente do funcionário a Visita desse Cliente. Essas condições não transformam o funcionário em objeto exclusivo do Cliente. Apresenta apenas estado/contagem da fila, sem payload ou erro bruto; as anotações são imutáveis, idempotentes e auditadas. Não modifica a fila nem inicia sincronização. Revisar política administrativa e exposição cruzada antes de qualquer grant/ativação; gates permanecem fechados.
