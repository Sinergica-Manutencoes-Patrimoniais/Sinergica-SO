---
name: product
description: PRD-lite — fecha o lado Auvo→PCM que ficou incompleto em E01-S22..S33: liga o cron real do motor genérico (hoje metadado morto), cobre Tickets, e faz OS/Tarefas nascidas no Auvo aparecerem no PCM.
alwaysApply: false
---

# Product — Reconciliação Auvo→PCM (cron real + OS/Tarefas)

> **Tier:** arquitetural · **Status:** aprovado (achado durante teste manual do Lucas do PR #30,
> 2026-07-07) · **Dono:** Claude (sessão Lucas)
> Épica: continuação de "PCM como front-end completo do Auvo" (E01-S22..S33).

## Problema
Testando o PR #30 em browser, o Lucas achou que Ordens de Serviço abertas direto no Auvo (sem
passar pelo PCM) nunca aparecem no PCM — nem no Hub de OS nem no Dashboard. Investigando a causa,
achamos algo maior: **9 dos 12 descriptors do motor genérico (E01-S22/S23) declaram
`cronSchedule`, mas nenhuma migration jamais criou o `pg_cron` que chama `pcm-auvo-pull` — é
metadado morto desde que `E01-S23` foi escrito.** Isso significa que Tipos de Tarefa, Segmentos,
Palavras-chave, Categorias (produto/equipamento), Grupos de Clientes, Ferramentas, Serviços e
Equipes **nunca sincronizaram nada do Auvo pro PCM**, nem por webhook (essas entidades não têm
webhook Auvo) nem por cron (nunca ligado). Tickets (E01-S33) tem o mesmo problema: só webhook, sem
cron de segurança. E o caso original — Ordens de Serviço — tem webhook, mas ele só faz `UPDATE`
numa OS já existente por `auvo_task_id`; nunca cria uma OS nova quando a tarefa nasceu no Auvo.

## Para quem
Fabrício e demais colaboradores do escritório que usam o PCM como fonte única de verdade
operacional — hoje, qualquer coisa criada direto no Auvo por um técnico de campo fica invisível no
PCM até alguém descobrir manualmente.

## Resultado esperado / métrica de sucesso
- Métrica: nº de entidades do catálogo com sincronização Auvo→PCM real e verificável (hoje: 3 de
  12 — clientes/funcionários/equipamentos, via cron legado de `E01-S09`/`S11`/`S13`, não pelo motor
  novo). Alvo: 12 de 12 entidades + Ordens de Serviço.
- Baseline: OS aberta direto no Auvo — invisível no PCM hoje, para sempre (sem intervenção manual).
- Alvo: aparece no PCM em até 1h (webhook em tempo real quando o Auvo dispara; import de
  reconciliação como rede de segurança pro que o webhook perder/tarefas antigas).

## Goals
- Ligar de verdade o `pg_cron` que chama `pcm-auvo-pull` para as 9 entidades com `cronSchedule` já
  declarado — sem inventar mecanismo novo, só terminar o que `E01-S23` deixou pela metade.
- Adicionar `cronSchedule` em Tickets (rede de segurança; webhook continua sendo o caminho
  primário de tempo real).
- Webhook de Task cria uma OS nova quando `auvo_task_id` não bate com nenhuma local (hoje só
  ignora), pros casos de tarefa nova criada direto no Auvo chegar em tempo real.
- Import de reconciliação para Ordens de Serviço (mesmo padrão de `pcm-auvo-customers-import`,
  `E01-S13`): backfill de tarefas antigas que existiam antes desta mudança + rede de segurança
  para o caso do webhook falhar/não estar registrado.

## Non-goals
- Migrar Clientes/Funcionários/Equipamentos do cron legado (`E01-S09`/`S11`/`S13`) pro motor novo —
  já funcionam hoje (ainda que por um caminho duplicado, achado C2 da revisão anterior); unificar é
  limpeza técnica, não um bug de produto, fica pra outra story.
- Espelhar o payload rico da tarefa Auvo (checklist, fotos, controle de horas) na OS criada por
  reconciliação — a OS nasce com os campos mínimos (título, cliente, categoria default,
  `origem='auvo'`); o enriquecimento já existente do webhook (`E01-S15`, `upsertTaskSnapshot`)
  continua rodando por cima assim que a OS existir.
- Sincronização incremental/delta (só o que mudou desde o último pull) — `pcm-auvo-pull` sempre
  pagina a entidade inteira; aceitável para catálogos pequenos, pode não escalar para Tickets/OS se
  o volume crescer muito — sinalizado como risco, não resolvido aqui.
- GUT automático pra OS criada via Auvo — nasce com `gravidade/urgencia/tendencia` nulos (mesmo
  comportamento de OS sem GUT preenchido hoje); o escritório ajusta manualmente se quiser priorizar.

## Riscos / premissas
- Premissa: cliente da tarefa Auvo já está sincronizado no PCM (`pcm.clientes.auvo_id`) na hora do
  webhook/import rodar — `client_id` é `NOT NULL` em `pcm.ordens_servico`, então tarefa de cliente
  ainda não sincronizado é pulada (log de aviso), não quebra o processamento das demais.
- Risco: `numero` (CH-XXX) usa `count()` — mesma dívida de race condition já documentada em
  `pcm-ze-agent`/`E01-S02`; se criação concorrente virar problema real, vira `sequence`/RPC.
- Risco: rodar `pcm-auvo-pull` de 9 entidades no mesmo horário (06:00 UTC) pode gerar rajada
  simultânea de chamadas ao Auvo — mitigado espaçando as chamadas dentro do job (delay artificial
  entre entidades), dentro do budget de 400 req/min já usado como referência desde `E01-S22`.
