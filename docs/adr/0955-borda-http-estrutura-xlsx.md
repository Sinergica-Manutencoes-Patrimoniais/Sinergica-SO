---
name: "docs-adr-0955-borda-http-estrutura-xlsx-md"
description: "Documento Sinérgica SO: ADR-0955 — Borda experimental XLSX de estrutura"
alwaysApply: false
---

# ADR-0955 — Borda experimental XLSX de estrutura

Status: código de borda não registrado, não homologado.

Preparar POST de bytes com Cliente e requestId, origem e aba explicitamente codificadas, CORS restrito, autenticação, limite por usuário e autorização antes de ler o corpo. Impor tamanho progressivo e prazo de leitura; encaminhar ao serviço atestado e responder somente identificadores mínimos. Falha após iniciar processamento é resultado incerto: preservar requestId e mesmos bytes no retry; não reenviar com identidade nova.

Não há configuração, deploy, segredo ou liberação de gate. Autenticação/limitação são dependências injetadas; seu funcionamento real, cancelamento, proteção distribuída, edge runtime, permissões, HMAC e risco de memória ainda precisam prova e revisão adversarial. Não aceitar arquivos reais até essas condições estarem satisfeitas.
