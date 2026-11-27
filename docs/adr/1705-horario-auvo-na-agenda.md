---
name: adr-1705
description: Horários das tarefas Auvo já sincronizadas na projeção da Agenda do Técnico.
alwaysApply: false
---

# Horário Auvo na Agenda do Técnico

E01-S202 · DEF-03. A Agenda usa o horário agendado das tarefas Auvo das OS ativas
com vínculo vigente à Visita. A importação grava `taskDate` em
`pcm.ordens_servico.data_agendada`. O identificador `auvo_task_id` distingue as
OS que têm tarefa Auvo. A coluna Visita do Monitor usa o início local planejado
no PCM e tem uma origem diferente.

A consulta nova reutiliza o recorte e a autorização da projeção existente. Ela
retorna os horários distintos, ordenados e formatados em `HH:MM` no fuso
da Visita. Quando a lista é vazia, a interface exibe o período. A data e a
equipe continuam vindo da Visita.

A migração adiciona uma RPC de leitura. O contrato anterior permite publicar ou
reverter o frontend independentemente. Durante a publicação da migração, se o
PostgREST ainda não conhecer a RPC nova, o frontend consulta a projeção anterior
e usa o período. O retorno completo consiste em reverter o frontend e remover
a RPC nova em migração posterior.
