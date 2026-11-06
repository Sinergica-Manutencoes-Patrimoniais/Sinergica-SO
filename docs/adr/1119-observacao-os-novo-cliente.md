---
name: "docs-adr-1119-observacao-os-novo-cliente-md"
description: "Documento Sinérgica SO: ADR-1119 — Iniciar observação da OS no Cliente atual"
alwaysApply: false
---

# ADR-1119 — Iniciar observação da OS no Cliente atual

Status: proposta local, não aplicada nem homologada.

## Decisão

Quando houver conflito registrado e a OS estiver no Cliente atual, permitir a operador autorizado em ambos os Clientes iniciar nova observação local nesse Cliente mediante revisão e motivo. A operação serializa a OS e a observação, preserva os eventos e seus proprietários, registra um novo evento a partir da OS atual, decisão imutável e auditoria. A ação não transfere a OS, dados históricos, custos ou conteúdo de outro Cliente; não confirma efeito remoto nem resolve a integração externa.

## Limites

O conflito exige revisão atual e autorização em ambos os Clientes; troca de propriedade ou revogação invalida a tentativa. O histórico isolado por ADR-1118 e todos os leitores/gravações legados precisam de revisão antes de ativação. Testar retomada, concorrência de varredura/transferência, vazamento entre Clientes, RLS/FORCE, eventos, integrações e revisão adversarial. Gate permanece fechado; não implantar isoladamente.
