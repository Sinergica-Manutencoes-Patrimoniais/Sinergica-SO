---
name: "docs-adr-0216-historico-triagem-intencao-md"
description: "Documento Sinérgica SO: ADR-0216 — Histórico minimizado da triagem de intenção"
alwaysApply: false
---

# ADR-0216 — Histórico minimizado da triagem de intenção

Status: proposta, não homologada.

Consulta paginada de eventos exige capacidades atuais de confirmar Visita e reconciliar integração para Cliente da intenção. Retorna ator, data, ação, revisão e classificação declarada, sem referência livre, motivo ou tarefa declarada. Cursor por revisão; não expõe credenciais ou payload nem confirma sucesso remoto.

Histórico permanece privado e RPC revogada; a anotação livre ainda exige políticas de retenção, segurança e recuperação administrativa. Falta teste de autorização e revogação, coordenação com execução remota, tratamento de evidência autenticada e revisão adversarial.
