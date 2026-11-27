---
name: adr-1705
description: Horários das tarefas Auvo já sincronizadas na projeção da Agenda do Técnico.
alwaysApply: false
---

# Horário Auvo na Agenda do Técnico

E01-S202 · DEF-03. A Agenda usa o horário recebido do Auvo nas tarefas das OS
ativas com vínculo vigente à Visita. A referência é `projecao.dataAgendada`
do último evento aceito da tarefa em `pcm.sso_origem_campo_eventos`, incluindo
o evento inicial criado pelo processamento de origem. O histórico de origem
valida a projeção contra o envelope recebido e permanece disponível mesmo
quando o PCM edita a data prevista da OS. A coluna Visita do Monitor usa
`visitas.inicio_em`.

A consulta reutiliza o recorte e a autorização da projeção existente e vincula
cada evento à tarefa Auvo atual, à OS e ao Cliente do processamento de origem.
Ela retorna horários distintos, em ordem e em `HH:MM` no fuso da Visita. Quando
o último evento aceito não tem hora ou a tarefa só tem dados legados na OS, a
Agenda exibe o período. A data e a equipe continuam vindo da Visita.

A migração adiciona uma RPC de leitura. O contrato anterior permite publicar ou
reverter o frontend independentemente. Durante a publicação da migração, se o
PostgREST ainda não conhecer a RPC nova, o frontend consulta a projeção anterior
e usa o período. O retorno completo consiste em reverter o frontend e remover
a RPC nova em migração posterior.
