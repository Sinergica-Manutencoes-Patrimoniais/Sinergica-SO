---
name: "docs-adr-0326-reatestacao-cobertura-transacional-md"
description: "Documento Sinérgica SO: ADR-0326 — Reatestar cobertura estrutural sob bloqueio"
alwaysApply: false
---

# ADR-0326 — Reatestar cobertura estrutural sob bloqueio

Status: proposta, não homologada.

Reatestação PCM exige conferência anterior, revisão atual de evidências e revisão de decisões versionadas sem histórico não reconciliado. A transação bloqueia o retorno e compartilha bloqueios das fontes disponíveis (envelope, OS, Cliente, vínculo, ocorrência, Plano, versão e respostas), então executa novamente a conferência estrutural existente e guarda a nova conferência com histórico e auditoria. A resolução é reavaliada enquanto o envelope está bloqueado. Nenhuma declaração de autenticidade externa é produzida.

O resultado não altera `cobertura_comprovada`, não aprova retorno nem encerra OS. Provar ausência de alterações por processos privilegiados e a validade do conteúdo externo exige revisão de concorrência, fonte e política. Gates e EXECUTE fechados; sem ativação até testes e revisão adversarial.
