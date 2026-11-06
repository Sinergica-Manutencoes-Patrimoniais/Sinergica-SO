---
name: "docs-adr-0425-evidencia-manual-os-remota-md"
description: "Documento Sinérgica SO: ADR-0425 — evidência manual de OS remota"
alwaysApply: false
---

# ADR-0425 — evidência manual de OS remota

Status: proposto; gate fechado, não aplicado nem homologado.

A triagem existente de 0388 já registra notas idempotentes com versão local. Esta extensão vincula a uma nota uma declaração humana estruturada sobre o resultado de consulta manual: nenhum, um, múltiplos candidatos ou desconhecido, com origem e referência informadas. A declaração é histórico imutável, não confirma a existência/ausência no Auvo, não associa tarefa, não resolve a ocorrência e não autoriza retentativa. A referência não deve conter credenciais, payload ou dados sensíveis.

O servidor reutiliza autorização `integracao.reconciliar`, revisão da OS e comando idempotente da triagem, sem requisição de rede. Antes de qualquer vínculo inequívoco ou retry, serão necessárias integração proprietária, evidência verificável, autorização e testes de concorrência/escopo. Sem deploy nem operação real.
