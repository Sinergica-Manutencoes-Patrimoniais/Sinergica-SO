---
name: "docs-adr-1184-fronteira-http-t24-md"
description: "Documento Sinérgica SO: ADR-1184 — Fronteira interna HTTP T−24"
alwaysApply: false
---

# ADR-1184 — Fronteira interna HTTP T−24

Status: proposta local, não registrada nem homologada.

Preparar handler interno com autenticação injetada antes da leitura do corpo, entrada JSON limitada e parâmetros numéricos estritos. Apenas contagens e motivo geral de parada são devolvidos; erros não expõem credenciais, payloads ou detalhes internos. A fronteira não se registra automaticamente e não fornece clientes, credenciais, transporte ou cron.

O autenticador concreto deve comprovar identidade de serviço; uma função injetada não é evidência de autorização. Limites de tempo do lote não interrompem requisição externa em voo. Validar autenticação real, limites de corpo, concorrência de invocações, timeouts, observabilidade, isolamento, contratos e revisão adversarial antes de registrar ou liberar a função.
