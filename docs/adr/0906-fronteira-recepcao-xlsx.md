---
name: "docs-adr-0906-fronteira-recepcao-xlsx-md"
description: "Documento Sinérgica SO: ADR-0906 — Fronteira de preparação XLSX"
alwaysApply: false
---

# ADR-0906 — Fronteira de preparação XLSX

Data: 2026-10-30 · Status: preparação, não conectada nem publicada.

## Decisão

Preparar um handler HTTP sem gravação para receber os bytes de uma fonte associada a Cliente, validar método e metadados, consultar autenticação e autorização antes de consumir o corpo, impor limite de bytes durante a leitura e encaminhar a cópia recebida ao processamento isolado. A resposta não entrega arquivo nem matriz; apenas informa resultado de preparação. Dependências de autenticação e processamento são injetadas, e falhas fecham o acesso sem expor erro interno. O handler não substitui autorização na transação de persistência.

## Implantação

Não registrar rota nem habilitar gates nesta etapa. Antes de uso: autorização real, bloqueio de concorrência entre instâncias, limites de tempo e memória, controle de acesso HTTP/CORS, observabilidade sem conteúdo, contrato de retenção e comando transacional que aceite apenas resultado de processamento confiável. Sem alterar CSV e sem envio ao Auvo. Falta provar compatibilidade do worker com Supabase Edge e executar revisão adversarial.
