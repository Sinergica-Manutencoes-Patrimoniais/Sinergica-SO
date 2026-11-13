---
name: "adr-1688-mensagem-do-aparelho-tira-o-ze"
description: "Mensagem enviada pelo próprio número do canal pausa a conversa e cancela a fila do Zé"
alwaysApply: false
---

# ADR-1688 — Mensagem do aparelho tira o Zé

## Estado

Aceito para implementação em E02-S39.

## Contexto

`fn_registrar_mensagem_celular` (migration 0207) grava a mensagem enviada pelo celular do canal,
mas **não tira a conversa do automático** — a equipe responde pelo WhatsApp Web ou pelo celular, e
o Zé responde de novo por cima, pro mesmo cliente, segundos depois. Relatado como bug real pelo
usuário (não investigado via SQL em produção nesta rodada — AC-0 da spec segue em aberto,
dependente de acesso a produção que este ambiente não tem).

## Decisão

- RPC nova `fn_registrar_mensagem_do_aparelho` grava a mensagem (mesmo author/direção de hoje:
  `direcao='saida'`, `remetente_tipo='humano'`, `origem_envio='celular'` ou `'celular_automatico'`)
  e, quando cabível, pausa a conversa (`modo='pausado'`) e atribui à pessoa configurada no canal,
  cancelando a fila pendente do Zé (`wa_queue` → `skipped`).
- "Ninguém" (`canal_aparelho.responsavel_id = null`) é a chave de desligar: nada muda além do
  histórico.
- Eco (mensagem que o próprio sistema acabou de enviar) é reconhecido por id (mesmo
  `wa_message_id` já gravado) e, na ausência de id, por texto normalizado de uma mensagem do
  sistema em envio nos últimos 20 minutos — nunca tira o Zé de novo.
- Texto automático do WhatsApp Business (lista configurável por canal) e mensagem atrasada (>15
  min) entram só no histórico.
- Segunda mensagem do aparelho não reatribui uma conversa já pausada por outra pessoa
  (`update ... where modo = 'auto'`).

## Risco aceito: corrida sem versão de responsável

A Sinérgica não tem `responsavel_versao`/CAS no caminho do Zé (diferente do TriviAtende). A trava
usada (`update conversas ... where modo = 'auto'` + `delete`/`skip` da fila) fecha a janela quase
toda, mas um item **já reivindicado** por um worker do Zé em voo no momento exato da mensagem do
aparelho ainda pode ser enviado. Risco aceito e testado (resposta do Zé já em voo chega mesmo
assim); adicionar CAS completo é escopo maior, fora desta story.

## Alternativas descartadas

**Autor novo `humano-aparelho`.** Quebraria CHECK, histórico, rótulos e relatórios que já tratam
`remetente_tipo='humano'`.

**Conversa sem dono até alguém assumir.** Ficaria "aguardando humano" mesmo já respondida.

**Eco só por id.** O webhook pode chegar antes de a entrega gravar o id; a resposta do Zé apareceria
duplicada na mensagem do aparelho.
