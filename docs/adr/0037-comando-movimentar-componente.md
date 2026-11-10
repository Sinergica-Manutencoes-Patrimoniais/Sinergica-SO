---
name: "docs-adr-0037-comando-movimentar-componente-md"
description: "Documento Sinérgica SO: ADR-0037 — Comando de movimentação de Componente"
alwaysApply: false
---

# ADR-0037 — Comando de movimentação de Componente

**Status:** decisão para implementação local E01-S176. **Data:** 2026-10-27.

`pcm.equipamentos` recebe revisão estrutural aditiva, inicial 1, incrementada em qualquer alteração efetiva de Cliente, Área, Local, pai, ativação ou exclusão lógica, inclusive pelas escritas legadas. A revisão não altera identificador nem códigos. A RPC transacional de movimentação exige `cadastro.gerir` no Cliente atual, revisão e `requestId`; preserva Cliente, delega validação de hierarquia/posição aos triggers, guarda resultado de repetição e registra correlação em `audit.events`. Repetição exige autorização atual para o Cliente original e o atual e não revalida referências posteriormente alteradas. Falhas revertem tudo.

Isso não fecha a autorização das escritas diretas legadas: a transição de RLS e concessões permanece gate antes da entrega. O comando ainda não está integrado à interface nem elimina as chamadas existentes. Testar concorrência real, integração Auvo/outbox e revisão adversarial antes de PASS. Reversão deve preservar dados, revisões, comandos e auditoria; não apagar nem reescrever registros.
