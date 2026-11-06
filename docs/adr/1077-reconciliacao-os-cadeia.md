---
name: "docs-adr-1077-reconciliacao-os-cadeia-md"
description: "Documento Sinérgica SO: ADR-1077 — Reconciliação de OS de continuidade"
alwaysApply: false
---

# ADR-1077 — Reconciliação de OS de continuidade

Status: proposta local, não aplicada nem homologada.

## Decisão

A reconciliação humana pode identificar explicitamente uma OS de continuidade, desde que o vínculo da OS à parcela seja inequívoco e a evidência pertença ao retorno dessa mesma OS e Cliente. O comando existente preserva revisão, autorização, motivo, idempotência, suspensão e interrupção; somente sua conferência de atribuição passa a reconhecer a fonte de cadeia da migration 1220. A listagem de evidências específica do ciclo inclui OS vinculadas, sem modificar a listagem compartilhada de revisão. Uma nova consulta específica aceita OS escolhida pelo operador e devolve o contexto dessa OS, sem substituir a consulta legada.

## Riscos e implantação

Nenhuma evidência ou declaração comprova parada remota ou autoriza devolução integral. O núcleo é compartilhado e precisa de inventário dos chamadores, revisão adversarial, prova de locks, concorrência, revogação, origem e acesso antes de ativação. As funções seguem privadas até concessão coordenada; gates existentes permanecem fechados. A consulta não é uma fotografia imutável entre requisições; comandos devem revalidar no servidor. Ciclos legados permanecem fora dos mediadores de ciclo posterior.
