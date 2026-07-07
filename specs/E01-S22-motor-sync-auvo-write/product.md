---
name: product
description: PRD-lite — motor de sync bidirecional PCM↔Auvo (metade write), primeira story da épica "PCM como front-end completo do Auvo".
alwaysApply: false
---

# Product — Motor de sync Auvo (write path: outbox + drain)

> **Tier:** arquitetural · **Status:** aprovado (plano de épica revisado com o usuário em
> 2026-07-06/07) · **Dono:** Claude (sessão Lucas)
> Épica: "PCM como front-end completo do Auvo" — plano em
> `~/.claude/plans/auvo-a-plataforma-ethereal-bonbon.md`.

## Problema
O Fabrício (escritório) ainda precisa abrir o Auvo diretamente para cadastrar/editar clientes,
funcionários, ferramentas, serviços, equipamentos, tickets — só os **técnicos de campo** deveriam
usar o Auvo (app mobile). Hoje o PCM só empurra 2 entidades pro Auvo (cliente, task de OS), cada
uma com seu próprio disparo direto via `pg_net` (sem retry, sem backoff, sem budget de rate
limit). Para dar CRUD de ~10 entidades novas sem escrever 10 disparos artesanais, é preciso um
**motor genérico** de propagação PCM→Auvo antes de qualquer tela nova.

## Para quem
Fabrício e demais colaboradores do escritório com permissão de escrita no módulo PCM — usuários
que hoje preenchem cadastros duas vezes (PCM e Auvo) ou só usam o Auvo para isso.

## Resultado esperado / métrica de sucesso
- Métrica: nº de disparos de sync PCM→Auvo com retry automático e rastreável (hoje: 0 — os 2
  fluxos existentes são fire-and-forget).
- Baseline: hoje, falha de rede/rate-limit numa chamada Auvo síncrona não tem retry — fica
  `auvo_sync_status='failed'` até reprocesso manual do trigger.
- Alvo: toda escrita PCM em entidade sincronizada dispara para o outbox e é entregue ao Auvo em
  até 1 min, com retry automático em falha transitória.

## Goals
- Um mecanismo único (outbox + drain) que qualquer entidade futura (E01-S24+) usa para propagar
  create/update/delete do PCM para o Auvo, sem escrever uma Edge Function de disparo por entidade.
- Idempotência por `externalId` (reaproveita ADR-0001) em todas as chamadas Auvo do motor.
- Nunca bloquear a escrita PCM: a propagação é sempre assíncrona.

## Non-goals
- Nenhuma entidade de cadastro concreta (Funcionários, Ferramentas, Serviços, ...) — isso é
  E01-S24 em diante, que só *usa* o motor.
- Read path (webhook dispatcher genérico + poller `pcm-auvo-pull`) — isso é `E01-S23`, mesmo
  `design.md`, spec/tasks própria.
- Substituir os 2 fluxos síncronos já existentes (`pcm-auvo-customers-sync`,
  `pcm-auvo-create-task`) — continuam como estão; o outbox é só para as entidades novas.
- Financeiro (Faturas/Despesas/Recebíveis) — descartado pelo usuário nesta épica (não usado pela
  Sinérgica).

## Riscos / premissas
- Premissa: o Auvo aceita `externalId` como chave de idempotência em todos os endpoints de
  cadastro do catálogo (confirmado só para `/customers` e `/tasks`; os demais endpoints — Users,
  Products, Services, Equipments, etc. — têm o mesmo parâmetro documentado na API v2, mas o
  comportamento real não foi exercitado contra produção ainda).
- Premissa: rate limit de 400 req/min é suficiente para outbox (drenagem 1x/min) + os pollers de
  E01-S23 rodando em paralelo — orçamento a confirmar quando os pollers entrarem.
- Risco: se `writeEnabled` não for respeitado à risca por entidade, um descriptor mal mapeado
  pode gravar lixo no Auvo de produção — mitigado exigindo `writeEnabled:false` por padrão em todo
  descriptor novo (ver `design.md` → Riscos).
