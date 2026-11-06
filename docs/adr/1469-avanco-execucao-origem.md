---
name: "docs-adr-1469-avanco-execucao-origem-md"
description: "Documento Sinérgica SO: ADR-1469 — Avanço limitado de execução pela origem"
alwaysApply: false
---

# ADR-1469 — Avanço limitado de execução pela origem

Status: preparação local, gate fechado; complementa ADR-1467 e ADR-1468.

Quando uma OS nova e acompanhada continua sem qualquer edição posterior, o evento aceito de campo em andamento ou concluído pode avançar a OS de `solicitacao` para `em_execucao`, junto à aplicação versionada. Não há avanço de outros estados nem regressão. O evento concluído não encerra a OS, não aprova a execução e não encerra o Chamado; permanece sujeito à validação PCM. A aplicação explicitamente conferida por operador continua preservando o status como decidido no ADR-1468.

A alteração usa o mesmo gate, controle de revisão e deduplicação do ADR-1467, sem novo acionamento Auvo. Exige antes de habilitar: provar contrato de estado do fornecedor, todos os triggers e efeitos da transição, concorrência com edição/validação/cancelamento, reentrega, auditoria, RLS/FORCE e revisão adversarial. Não autoriza deploy ou processamento real.
