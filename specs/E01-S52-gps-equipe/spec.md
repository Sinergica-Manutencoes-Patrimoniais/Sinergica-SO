---
name: spec
description: Contrato — mapa/última posição da equipe via GET /gps do Auvo (dor L5 "onde está minha equipe").
alwaysApply: true
---

# Spec — GPS da equipe no PCM

> **Fonte da verdade.** Status: rascunho · Tier: Pequeno
> Origem: `docs/AUDITORIA-AUVO-API.md` (10-07-2026). GPS confirmado **ativo** na conta real
> (5 técnicos com posição de alta precisão + nível de bateria, relatório Monitoramento do Auvo).
> A API expõe `GET /gps` (paginado): `userId`, `positionDate`, `latitude`, `longitude`, `accuracy`,
> `batteryLevel`, `networkOperatorName`. Hoje o PCM não consome nada disso — dor L1/L5 do
> ESCOPO-MESTRE (§2.1): "Onde está minha equipe?" = telefonema.

## Resumo
Poller de `/gps` grava posições em `pcm.gps_posicoes` (retenção curta) e uma view/consulta de
"última posição por técnico". Dashboard PCM ganha o card **"Equipe agora"**: técnico, cliente mais
próximo/OS em execução (check-in aberto), horário da posição, bateria, link "ver no mapa"
(Google Maps URL — sem lib de mapa neste MVP).

## Critérios de aceite

### AC-1: Pull de posições
- **Dado** o cron/`pcm-auvo-sync-all` rodando
- **Quando** o pull de GPS executa
- **Então** `pcm.gps_posicoes` recebe as posições novas (idempotente por `auvo_user_id + position_date`),
  associadas ao funcionário local via `pcm.funcionarios.auvo_id`

### AC-2: Última posição por técnico
- **Dado** posições gravadas
- **Quando** a UI consulta "equipe agora"
- **Então** devolve 1 linha por técnico ativo: última posição, idade da posição, bateria

### AC-3: Card "Equipe agora" no dashboard PCM
- **Dado** o dashboard PCM
- **Quando** carrega
- **Então** lista os técnicos com última posição (hora, bateria, link `https://maps.google.com/?q=lat,long`)
  e destaca posição velha (> 2h em horário comercial) — sem lib de mapa nova

### AC-4: Retenção
- **Dado** posições com mais de 7 dias
- **Quando** a rotina de limpeza roda
- **Então** são removidas (GPS é dado operacional volátil, não histórico auditável; LGPD — dado de
  localização de colaborador não se acumula sem finalidade)

### AC-5: Privacidade/horário
- **Dado** posição fora de horário operacional
- **Quando** exibida
- **Então** a UI não mostra posições fora da janela operacional (exibição limitada; a coleta segue a
  config do próprio app Auvo) — regra do escopo §2.1/L5 "em horário operacional"

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Mapa embutido (Leaflet/Google Maps JS) — MVP é lista + link externo; mapa vem com roteirização (§6.11).
- Rota percorrida/replay do dia, km rodado calculado.
- Alertas automáticos (radar F2 usa check-in/out, story própria futura).

## Rastreabilidade
- Auditoria: `docs/AUDITORIA-AUVO-API.md` · Dor: ESCOPO-MESTRE §2.1 L5, §6.11 (produtividade).
- Contrato API: `GET /gps` — **verificar contrato real com credencial de API antes da migration**
  (lição `taskID`/E01-S34; login de UI não valida API).
- Arquivos-âncora: `supabase/functions/pcm-auvo-pull` ou função dedicada, novo descriptor **não** se
  aplica (GPS não é entidade CRUD — é série temporal; avaliar função `pcm-auvo-gps-pull` própria),
  `apps/web/src/features/pcm/pages/PcmDashboardPage.tsx`.
