---
name: "docs-adr-0318-resolver-foto-retorno-servico-md"
description: "Documento Sinérgica SO: ADR-0318 — Resolver de foto somente no serviço"
alwaysApply: false
---

# ADR-0318 — Resolver de foto somente no serviço

Status: proposta, não homologada.

O caminho privado deixa de ser retornável por RPC ao usuário. A função de serviço, cuja execução é reservada a `service_role`, recebe somente identidade e papel extraídos pelo servidor após validar o JWT com Auth. A função estabelece contexto de autorização local à transação e reutiliza o resolver que confere capacidade atual, retorno, OS, nota, objeto e bucket; a rota repete a validação após download. A chave de serviço permanece exclusivamente na Edge Function. A política de acesso direto continua bloqueada e não se emite URL assinada.

Esta mediação depende de revisar autenticação dos claims, privilégios efetivos e isolamento do contexto transacional. Gate permanece fechado e deploy proibido antes de testes e revisão adversarial; o resolver de serviço é acessível apenas à função privilegiada, não a clientes.
