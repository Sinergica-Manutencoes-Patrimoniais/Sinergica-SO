---
name: product
description: PRD-lite — Inbox de Conversas (WhatsApp-only) dentro do módulo Atendimento, sobre a fundação de dados de E02-S01.
alwaysApply: false
---

# Product — Inbox de Conversas (UI, WhatsApp-only)

> **Tier:** arquitetural · **Status:** aprovado · **Dono:** Claude (sessão Lucas)
> Épica: E02 — Atendimento · Zé. Depende de `E02-S01` mergeada.

## Problema
Hoje um humano só sabe o que está acontecendo numa conversa de WhatsApp lendo o app diretamente —
não há visão consolidada de conversas no PCM, nem forma de assumir/responder/ver o histórico pelo
sistema. `E02-S01` deu a fundação de dados (`atendimento.conversas`/`mensagens`); falta a tela.

## Para quem
Fabrício e colaboradores do escritório com permissão de leitura/escrita no módulo `atendimento`.

## Resultado esperado / métrica de sucesso
- Métrica: % de conversas de WhatsApp visíveis e gerenciáveis pelo PCM sem precisar abrir o
  WhatsApp Web/app separadamente (hoje: 0%).
- Alvo: colaborador consegue ver todas as conversas ativas, assumir uma conversa do Zé, responder
  manualmente, e devolver ao Zé — tudo dentro do PCM.

## Goals
- Tela de Inbox (lista de conversas + chat + perfil do contato) dentro do módulo "Atendimento · Zé"
  já existente no menu principal (hoje `EmConstrucao`).
- Toggle IA/humano por conversa, reaproveitando o `modo` de `E02-S01`.
- "Responder com IA agora" — aciona o Zé sob demanda fora do ciclo normal de debounce.

## Non-goals
- Mídia (áudio/imagem/arquivo) nas mensagens.
- Instagram/Messenger (`E02-S04`).
- Dashboard de métricas (`E02-S03`).
- Qualquer tela de configuração (canais/IA/templates — `E02-S05`+).
- Editor de fluxo visual, scoring, personas múltiplas.

## Riscos / premissas
- Premissa: `E02-S01` já mergeada e com dado real fluindo (sem isso, a tela não tem o que
  mostrar).
- Risco: polling (sem React Query, primeira introdução de `setInterval` no projeto) pode gerar
  carga desnecessária se muitas abas ficarem abertas — mitigado pausando em
  `document.visibilitychange`.
- Risco: sem Deno CLI/Docker neste ambiente, nenhuma verificação automática do lado Edge Function
  é possível além de revisão manual — mesma ressalva de toda a integração desde `E01-S09`.
