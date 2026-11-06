---
name: "docs-adr-1183-processamento-lote-t24-md"
description: "Documento Sinérgica SO: ADR-1183 — Processamento limitado T−24"
alwaysApply: false
---

# ADR-1183 — Processamento limitado T−24

Status: proposta local, não conectada nem homologada.

Preparar composição de lote sequencial com limite explícito e relógio injetado. Cada candidata usa nova instância dos adaptadores, para não compartilhar fotografia de contrato ou IDs de pedido entre candidatas. Lote termina quando não há trabalho, atinge o limite/prazo, encontra resultado incerto ou ocorre erro. Nunca inicia uma nova candidata após o prazo; não interrompe operação externa já iniciada e não infere seu resultado.

O lote não registra rota, cron, credenciais ou transporte real. Limite de tempo não cancela chamada em andamento; timeout deve ser resolvido conservadoramente pelo transporte e livro de tentativas. Validação de segurança, contrato, configuração, observabilidade sem dados sensíveis, múltiplas instâncias, concorrência e revisão adversarial são obrigatórias antes de conectar ou habilitar.
