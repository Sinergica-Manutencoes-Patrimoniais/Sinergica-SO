---
name: spec
description: Contrato — atendimento.conversas/mensagens, integração aditiva do webhook/ze-agent, Edge Function de envio humano.
alwaysApply: true
---

# Spec — Fundação do Inbox de Atendimento

> **Fonte da verdade.** Status: aprovado · Tier: arquitetural
> Depende de: `E01-S02` (Agente Zé, `config_ze`/`wa_messages`/`wa_queue` já em produção).

## Critérios de aceite

### AC-1: Mensagem recebida cria/atualiza conversa e mensagem, mesmo com Zé desligado
- **Dado** uma mensagem chega via webhook Evolution para um `(instance_id, remote_jid)` qualquer
- **Quando** o webhook processa (independente de `config_ze.modo`)
- **Então** existe uma linha em `atendimento.conversas` para aquele par e uma linha em
  `atendimento.mensagens` com o conteúdo recebido

### AC-2: Resposta do Zé fica registrada como mensagem
- **Dado** o Zé responde (pergunta incompleta ou confirmação de OS) via `responderEvolution`
- **Quando** a chamada ao Evolution é feita
- **Então** existe uma linha em `atendimento.mensagens` com `remetente_tipo='ze'`,
  `direcao='saida'`, refletindo sucesso/erro real do envio

### AC-3: Pausa por conversa não afeta o condomínio inteiro
- **Dado** `atendimento.conversas.modo='pausado'` para uma conversa específica
- **Quando** uma nova mensagem chega para essa conversa
- **Então** o Zé não responde, mesmo que `config_ze.modo='active'` para aquele condomínio —
  outras conversas do mesmo condomínio continuam funcionando normalmente

### AC-4: Cliente ainda não sincronizado não quebra o fluxo
- **Dado** o `group_jid` da mensagem não resolve para nenhum `config_ze`/`client_id`
- **Quando** o webhook processa
- **Então** a conversa é criada com `client_id=null`, sem lançar erro, visível no Inbox mesmo sem
  vínculo a cliente

### AC-5: OS criada pelo Zé fica linkada à conversa
- **Dado** o Zé cria uma OS (fluxo já existente de `E01-S02`)
- **Quando** o insert em `pcm.ordens_servico` é concluído
- **Então** `atendimento.conversas.ordem_servico_id` aponta para a OS criada

### AC-6: Envio humano grava e manda a mensagem
- **Dado** um usuário autenticado com `podeAcessar('atendimento','escrita')` chama
  `atendimento-whatsapp-envio` com `acao:'enviar'`
- **Quando** a chamada ao Evolution tem sucesso
- **Então** a mensagem fica com `status_entrega='enviado'`; em caso de falha do Evolution,
  `status_entrega='erro'` + `erro_detalhe`, sem lançar exceção não tratada

### AC-7: RLS FORCE nas 2 tabelas novas
- **Dado** um usuário sem `user_modulos.atendimento` (nem `leitura` nem `escrita`)
- **Quando** tenta `select`/`insert`/`update` em `conversas`/`mensagens`
- **Então** a operação é negada (`42501`)

## Casos de borda e erros
- Reentrega da mesma mensagem Evolution (retry de rede): idempotente via `wa_message_id` unique
  em `mensagens` — não duplica.
- `atendimento-whatsapp-envio` chamado para uma `conversaId` que o usuário não tem permissão de
  ler: a RLS de `select` já barra antes de qualquer side-effect.
- `forcar:true` no `pcm-ze-agent`: não deve quebrar o comportamento do cron de fallback existente
  (chamada sem esse campo continua idêntica a antes desta story).

## Fora de escopo
- Ver `product.md` → Non-goals.

## Rastreabilidade
- Design: `design.md` (este diretório).
- Depende de: `specs/0002-abertura-chamado-ze/` (Agente Zé, `E01-S02`).
- Habilita: `E02-S02` (Inbox de Conversas, UI).
