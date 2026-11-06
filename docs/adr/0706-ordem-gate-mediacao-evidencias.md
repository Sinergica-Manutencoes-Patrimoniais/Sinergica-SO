---
name: "docs-adr-0706-ordem-gate-mediacao-evidencias-md"
description: "Documento Sinérgica SO: ADR-0706 — Verificação do gate antes da existência de objetos"
alwaysApply: false
---

# ADR-0706 — Verificação do gate antes da existência de objetos

Os helpers de mediação de quarentena e evidência verificam o gate da ADR-0687 e a identidade antes de consultar identificadores. Para gate aberto, objeto inexistente ou acesso não autorizado retorna a mesma condição de acesso negado. Assinaturas, privilégios e autorização de gestão ou aprovação por Cliente permanecem inalterados.

O gate permanece fechado; testes de isolamento, respostas uniformes e revisão de segurança são necessários antes da ativação.
