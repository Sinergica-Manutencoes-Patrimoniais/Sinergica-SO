---
name: design-E02-S09-agente-comercial-whatsapp
description: Desenho do runtime do agente comercial sobre a fila WhatsApp compartilhada.
alwaysApply: false
---

# Design — Agente comercial via WhatsApp

> Tier arquitetural · aprovado

## Fluxo
`pcm-whatsapp-webhook` persiste a mensagem e a fila por `instance_id:remote_jid`.
`pcm-ze-agent` resolve `atendimento.instancias_agente` antes do fallback legado; uma persona do tipo
`comercial` carrega prompt, modelo, base/RAG, agenda, fluxo e regras próprias. Ao concluir, cria
`comercial.leads`, liga o lead à conversa e ao `relacionamento.contatos` e responde pela mesma
instância Evolution.

## Segurança e falhas
- Entrada do WhatsApp é dado não confiável delimitado no prompt.
- Saída do LLM é JSON validado e normalizado antes de persistir.
- Segredos da Evolution/OpenRouter ficam somente nas Edge Functions.
- Handoff pausa a conversa de forma auditável; reentrega de webhook não reprocessa a mensagem.

## Dependências
E02-S06 (personas), E02-S07 (fluxos), E02-S08 (contatos) e E02-S22 (roteamento multi-instância).
