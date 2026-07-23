---
name: threat-model-E02-S09-agente-comercial-whatsapp
description: Ameaças do agente comercial e controles aplicados.
alwaysApply: false
---

# Threat model — Agente comercial

| Ameaça | Impacto | Controle |
|---|---|---|
| Prompt injection pelo contato | ação/saída fora do contrato | dados delimitados, prompt versionado e JSON validado |
| Webhook forjado | lead/mensagem falsa | token/HMAC antes do parse |
| Reentrega | resposta ou lead duplicado | `message_id` único e fila só após insert novo |
| Mistura entre agentes | vazamento de regra/base | vínculo exato `instance_id → persona_id` |
| Loop `fromMe` | respostas infinitas | descarte antes da persistência/fila |
| Excesso de chamadas | indisponibilidade/custo | rate limit por instância |
