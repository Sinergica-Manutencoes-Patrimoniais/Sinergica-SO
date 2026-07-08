---
name: product
description: PRD-lite — fundação de dados do Inbox de Atendimento (conversas/mensagens) e integração do Agente Zé como agente dentro dessa estrutura, primeira story da épica E02.
alwaysApply: false
---

# Product — Fundação: schema de conversas + Zé como agente do Inbox

> **Tier:** arquitetural · **Status:** aprovado (plano de épica revisado com o usuário em
> 2026-07-07) · **Dono:** Claude (sessão Lucas)
> Épica: E02 — Atendimento · Zé. Plano completo em
> `~/.claude/plans/nesse-projeto-tem-o-lively-creek.md`.

## Problema
Hoje não existe registro de "conversa com estado de atendimento" no PCM — só o log bruto
(`atendimento.wa_messages`) e a fila efêmera do Agente Zé (`atendimento.wa_queue`, ciclo de vida
por rajada de mensagem). Não dá pra saber quais conversas estão abertas, quem está cuidando de
cada uma, nem pausar o Zé numa conversa específica sem desligar a automação do condomínio inteiro
(`atendimento.config_ze.modo` é por condomínio, não por conversa). O Lucas quer trazer o módulo de
Atendimento completo do projeto `heziomos-main` — esta story é a fundação de dados sobre a qual o
Inbox humano (E02-S02) será construído.

## Para quem
Fabrício e demais colaboradores do escritório que vão usar o Inbox de Atendimento (E02-S02) para
ver/assumir conversas de WhatsApp com condomínios.

## Resultado esperado / métrica de sucesso
- Métrica: existência de um registro de conversa por `(instância, JID)` que sobrevive além da
  rajada de mensagens (hoje: 0 — `wa_queue` é limpo a cada ciclo `pending→done`).
- Alvo: toda mensagem recebida via Evolution cria/atualiza uma conversa e uma mensagem
  persistente, mesmo quando o Zé está desligado para aquele condomínio.

## Goals
- Registro de conversa (`atendimento.conversas`) e mensagem (`atendimento.mensagens`) que
  sobrevivem além do ciclo de vida da fila de debounce do Zé.
- Zé continua criando OS automaticamente quando os 3 dados estão prontos (comportamento de
  `E01-S02` preservado, zero regressão) E ao mesmo tempo grava toda a conversa na nova estrutura,
  visível para o humano.
- Modo de pausa **por conversa** (`conversas.modo`), distinto do modo por-condomínio já existente
  (`config_ze.modo`) — humano assumir uma conversa não desliga a automação do condomínio inteiro.
- Ponto de envio humano (Edge Function) que grava e efetivamente manda a mensagem pelo WhatsApp.

## Non-goals
- UI (Inbox) — isso é `E02-S02`, story separada, depende desta.
- Envio de mídia (áudio/imagem/arquivo) — `mensagens.tipo_conteudo` já deixa a porta aberta pro
  futuro, mas o parsing do webhook hoje só extrai texto.
- Qualquer canal além de WhatsApp/Evolution — Instagram/Messenger são `E02-S04`, fora de escopo.
- Dashboard/métricas — `E02-S03`.
- Alterar `atendimento.wa_messages`/`wa_queue`/`config_ze` — continuam exatamente como estão,
  cumprindo o mesmo papel de hoje (log de transporte + fila de debounce + config por condomínio).

## Riscos / premissas
- Premissa: `config_ze.group_jid` é resolvível para a maioria das mensagens recebidas — quando
  não for (condomínio ainda sem config), a conversa é criada com `client_id=null` (nullable por
  design) e fica visível no Inbox mesmo assim, só sem vínculo a um cliente PCM ainda.
- Risco: `numero` de OS (herdado de `E01-S02`, via `count()`) tem race condition conhecida sob
  concorrência real — dívida já aceita, não resolvida aqui.
- Risco: mudanças em `pcm-ze-agent`/`pcm-whatsapp-webhook` tocam código de produção ativo desde
  `E01-S02` — mitigado fazendo só adições (novos inserts/updates), sem reordenar nem remover
  nenhuma lógica existente.
