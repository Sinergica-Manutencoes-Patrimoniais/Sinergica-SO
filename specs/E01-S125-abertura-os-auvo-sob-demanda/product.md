---
name: product
description: Problema, público e métrica da feature. Base do tier arquitetural.
alwaysApply: true
---

# Product — Abertura de OS no Auvo sob demanda (fim do automático)

> Origem: pedido do Lucas (2026-08-04, item 6). "Desative a inteligência de abrir OS no Auvo
> automaticamente; em troca, ao trocar de status pergunte se deseja abrir OS no Auvo e deixe
> disponível na tela do Chamado um botão 'Abrir OS Auvo' que abre a OS com aqueles dados; antes de
> abrir faça um dry-run para confirmar os campos de abertura."

## Problema
Hoje, ao mover um Chamado/OS para **Planejamento**, um trigger de banco
(`fn_auvo_create_task_on_planejamento`) cria automaticamente a task no Auvo. Isso tira o controle do
operador: a OS vai pro campo (Auvo) sem revisão dos dados de abertura (técnico, data, tipo,
orientação, endereço), e sem chance de conferir antes. Erros de abertura só aparecem depois, já no
Auvo, difíceis de desfazer.

## Para quem
Supervisor/PCM que planeja e despacha OS. Precisa **decidir e conferir** o que vai pro Auvo, não ser
surpreendido por uma criação automática.

## Métrica de sucesso
- 0 tasks criadas no Auvo sem confirmação humana (o automático deixa de existir).
- Toda abertura passa por um dry-run que o operador confirma.
- Nenhuma OS "presa" sem ir pro Auvo por falta de caminho manual (o botão sempre existe).

## Goals
- Desligar a criação automática ao entrar em Planejamento.
- Ao mover pra Planejamento, **perguntar** se deseja abrir no Auvo, mostrando um **dry-run** dos
  campos que serão enviados.
- Botão explícito "Abrir OS Auvo" na tela do Chamado/OS, disponível sempre que ainda não há task.
- Idempotência: nunca duplicar task se a OS já tem `auvoTaskId`.

## Non-goals
- Editar a task depois de criada (é a E01-S121).
- Reescrever o webhook de volta do Auvo (E01-S10/S15 seguem iguais).
- Sincronizar campos além dos de abertura de tarefa.
