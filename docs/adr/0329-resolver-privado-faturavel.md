---
name: "docs-adr-0329-resolver-privado-faturavel-md"
description: "Documento Sinérgica SO: ADR-0329 — Resolução mediada do comprovante faturável"
alwaysApply: false
---

# ADR-0329 — Resolução mediada do comprovante faturável

Status: proposta; nenhuma concessão ou deploy nesta etapa.

O navegador só chama a Edge autenticada. Após validar o token, a Edge pede ao serviço privilegiado uma resolução restrita ao papel de serviço; o banco revalida a autorização financeira do usuário autenticado e o vínculo do arquivo. A RPC original que retorna caminho permanece revogada para os papéis de aplicação. A identidade transmitida ao banco vem exclusivamente da validação do token na Edge, nunca do corpo do navegador; a credencial privilegiada fica no servidor. O serviço pode personificar usuários e deve ser tratado como limite de confiança; proteger a credencial e auditar deploy/concessões. Falhas, revogação entre consultas, alterações de claims e autorização devem ser testadas antes de ativar. Auditoria individual de download segue pendente.
