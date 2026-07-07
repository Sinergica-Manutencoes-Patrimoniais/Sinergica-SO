---
name: spec
description: Contrato — CRUD de Equipes no PCM, sincronizado com Auvo /teams (cron, sem webhook, sem PATCH/DELETE — só criar e ler).
alwaysApply: true
---

# Spec — Equipes (Teams)

> **Fonte da verdade.** Status: aprovado com escopo reduzido pela API · Tier: Pequeno
> Endpoint: `/teams`. Sem webhook. **`/teams` só documenta `POST` (criar) e `GET` (por id, lista,
> participantes) — sem `PATCH` nem `DELETE`.** Esta é a entidade com a API mais restrita do
> catálogo mapeado até aqui.

## Resumo
Equipes (agrupamento de técnicos) ganham cadastro no PCM. Diferente de todas as outras entidades
desta épica, **editar ou excluir uma Equipe no PCM não propaga ao Auvo** (a API não suporta) —
a tela deixa isso explícito para não criar a expectativa de que "editar aqui edita lá".

## Contexto específico (ler antes de implementar)
- `POST /teams/`: `description` (obrigatório), `participants[]` (ids de usuário), `managers[]`
  (ids de usuário) — cria a equipe e já associa participantes/gestores numa única chamada.
- `GET /teams/{teamId}/users`: lista participantes (paginado) — útil para a tela mostrar quem
  está na equipe sem duplicar o vínculo no PCM (ler sob demanda, não espelhar).
- **Sem `PATCH`/`DELETE`**: `supportsUpdate:false` (editar nome/participantes é só local) e
  `deleteStrategy:'unsupported'` (excluir é só local) — ambos campos aditivos já implementados em
  `pcm-auvo-push` desde a correção feita ao mapear esta story.
- Sem `externalId` no `POST` — mesma mitigação de match-by-description de `E01-S24`/`E01-S25`
  antes de criar (evitar duplicar a mesma Equipe em retries).
- Cadência de poller: a cada 6h.

## Critérios de aceite

### AC-1: Criar Equipe propaga ao Auvo (só criação, sem edição futura)
- **Dado** um usuário com `podeAcessar('pcm','escrita')` cria uma Equipe com nome e uma lista de
  técnicos (por `auvo_user_id`, resolvidos a partir de `pcm.funcionarios`/`tecnicos_cache`)
- **Quando** salva
- **Então** `pcm.equipes` ganha a linha, o outbox enfileira, o drain cria em `/teams/` com
  `participants`/`managers` resolvidos, grava `auvo_id`

### AC-2: Editar Equipe é só local — UI avisa explicitamente
- **Dado** uma Equipe já sincronizada
- **Quando** o usuário edita nome ou participantes no PCM
- **Então** a mudança fica só no PCM (`supportsUpdate:false`, o drain trata como no-op de
  sucesso); a tela mostra um aviso permanente tipo "Alterações em Equipes não refletem no Auvo —
  gerenciar participantes lá também, se necessário"

### AC-3: Excluir Equipe é só local
- Mesmo espírito do AC-2, para exclusão (`deleteStrategy:'unsupported'`).

### AC-4: Mudança no Auvo chega ao PCM via poller a cada 6h
- **Dado** uma Equipe criada/editada diretamente no Auvo
- **Quando** o poller roda
- **Então** `pcm.equipes` é atualizado (upsert por `auvo_id`) — este é o único caminho real de
  "editar" uma Equipe já sincronizada e ver o reflexo nos dois lados (editar no Auvo, não no PCM)

### AC-5: Tela com gate de permissão + RLS FORCE
- Mesmo padrão das demais entidades.

## Casos de borda e erros
- Criar Equipe com participante sem `auvo_user_id` (funcionário nunca sincronizado): bloquear na
  UI com mensagem clara.
- Duas Equipes com o mesmo nome: permitido (sem unicidade de negócio conhecida).

## Fora de escopo
- Editar/excluir Equipe propagando ao Auvo (API não suporta).
- Gerenciar participantes/gestores após a criação inicial pelo PCM (só leitura via
  `GET /teams/{id}/users`, sem UI de adicionar/remover participante depois de criada — se
  necessário, é feito no Auvo).

## Rastreabilidade
- Design/Domínio: `../E01-S22-motor-sync-auvo-write/{design.md,domain.md}` (achado
  `deleteStrategy:'unsupported'` documentado ali)
- Depende de: `../E01-S28-funcionarios/spec.md` (resolver `auvo_user_id` dos participantes)
