---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Integração Auvo: Sync de Técnicos, Equipes e Equipamentos (Auvo → PCM, espelho read-only)

> **Fonte da verdade.** Status: aprovado — decisão de gatilho do sync confirmada em 2026-07-03
> (ver AC-5 e "Casos de borda").
> Tier: Pequeno (reaproveita a fundação/ACL de `E01-S09` — direção invertida: Auvo é a fonte,
> PCM espelha). Sem `design.md` próprio; consome o design de `E01-S09`.

## Resumo
O PCM passa a manter um cache local, somente leitura, de técnicos/equipes e equipamentos
cadastrados no Auvo — para exibir nomes/times reais na UI do PCM (ex.: quem está atribuído a uma
OS) sem chamar a API do Auvo a cada renderização de tela.

## Critérios de aceite

### AC-1: Sync de técnicos popula o cache local
- **Dado** usuários (`userType = 1`, colaborador de campo) cadastrados no Auvo
- **Quando** a Edge Function `pcm-auvo-users-sync` é executada (via `pg_cron` diário ou via
  chamada HTTP autenticada sob demanda — ver AC-5)
- **Então** `pcm.tecnicos_cache` é populado/atualizado com `auvo_user_id`, nome, equipe — um
  upsert por `auvo_user_id`, nunca duplica.

### AC-2: Sync de equipamentos popula o cache local
- **Dado** equipamentos cadastrados no Auvo vinculados a clientes já sincronizados
  (`pcm.clientes.auvo_id`)
- **Quando** a Edge Function `pcm-auvo-equipment-sync` é executada
- **Então** o cache local de equipamentos é populado/atualizado — um upsert por
  `auvo_equipment_id`, vinculado ao `pcm.clientes` correspondente via `auvo_id`.

### AC-3: Cache é somente leitura do ponto de vista do PCM
- **Dado** o cache de técnicos/equipamentos já populado
- **Quando** qualquer código do PCM (fora das duas Edge Functions de sync) tenta escrever nessas
  tabelas
- **Então** a RLS/policy bloqueia — só o `service_role` das Edge Functions de sync grava; a
  fonte da verdade desses dados é sempre o Auvo, nunca o PCM (documentado em
  `docs/blueprint/integracoes/auvo.md` → "Divisão de responsabilidades").

### AC-4: Técnico/equipamento removido no Auvo não quebra a UI do PCM
- **Dado** um técnico que existia no cache e foi removido/desativado no Auvo
- **Quando** o próximo sync roda
- **Então** o registro no cache é marcado inativo (soft delete, ex. `ativo = false`), não
  deletado fisicamente — OS históricas que referenciam esse técnico continuam exibindo o nome.

### AC-5: Gatilho do sync — agendado + sob demanda
- **Dado** as Edge Functions `pcm-auvo-users-sync`/`pcm-auvo-equipment-sync` implantadas
- **Quando** (a) o `pg_cron` dispara no horário agendado (diário, fora do horário comercial), OU
  (b) alguém faz uma chamada HTTP autenticada (`service_role`/superadmin) diretamente à Edge
  Function
- **Então** o sync roda do mesmo jeito nos dois casos — a Edge Function não sabe nem se importa
  quem/o que a invocou, só que a chamada é autenticada. Não há botão de UI dedicado nesta story
  (fora de escopo, ver abaixo); "sob demanda" aqui significa que a função é invocável a qualquer
  momento via `supabase functions invoke` / `curl` autenticado, não que existe uma tela para isso.

## Casos de borda e erros
- Paginação: `GET /users` e `GET /equipments` são paginados (mapeamento §2.2, §2.x) — o sync
  precisa iterar todas as páginas, não só a primeira.
- Rate limit: sync em lote pode se aproximar do limite de 400 req/min se o número de
  clientes/técnicos crescer — usar `pageSize` alto (100) para minimizar chamadas.
- `pg_cron` roda como `service_role` (mesmo padrão de outros triggers assíncronos já existentes
  via `pg_net`/`pg_cron` no schema `pcm`) — sem segredo de usuário embutido no job SQL.

## Fora de escopo
> Vinculante. Não implemente nada aqui.
- Qualquer escrita do PCM de volta para o Auvo sobre técnicos/equipamentos (direção é
  estritamente Auvo → PCM aqui — diferente de `E01-S09`, que é PCM → Auvo).
- Webhook em tempo real para `entity=User`/`entity=Equipment` — este story usa sync por
  agendamento/manual; migrar para webhook fica como melhoria futura se a defasagem do cache virar
  problema real.
- Tela de configuração de integrações (botão "Sincronizar", frequência do cron) — a Edge Function
  e o cache são o backend; a UI é uma story separada de Gestão/Cockpit se necessário.
- Hierarquia de equipamentos (Torre > Sistema > Equipamento) do lado PCM — já é responsabilidade
  do PCM (`docs/blueprint/integracoes/auvo.md`), este story só espelha o que o Auvo tem, não
  reconstrói a hierarquia.

## Rastreabilidade
- Design técnico: `../E01-S09-integracao-auvo-fundacao/design.md` (cliente HTTP, ACL —
  reaproveitados aqui)
- Blueprint de origem: `docs/blueprint/integracoes/auvo.md` (Edge Functions
  `pcm-auvo-users-sync`, `pcm-auvo-equipment-sync`; "Técnicos/equipes: Auvo é a fonte; PCM
  espelha via API (`pcm.tecnicos_cache`)")
- Mapeamento de API consultado: `Auvo-API-Mapeamento-Completo.md` §2.2 (Users), §2.x
  (Equipamentos), §5 (contagem de endpoints)
