---
name: spec-E01-S87-detalhe-equipamento-sistema-historico
description: Contrato — visão detalhada de equipamento e sistema com histórico de OS/manutenções/preventivas executadas.
alwaysApply: true
tier: pequeno
---

# Spec — Visão detalhada de equipamento/sistema (histórico)

> **Fonte da verdade.** Status: aprovado
> Origem: reunião Lucas × Fabrício (2026-07-16), item 2.4 + trecho sobre "última vez que esse
> equipamento teve manutenção/preventiva — é interessante ter esse controle".

## Resumo
Cada **equipamento** e **sistema** ganha uma visão detalhada que mostra o **histórico**: últimas OS
executadas, manutenções e preventivas — respondendo "quando foi a última manutenção deste ativo".

## Contexto atual (AS-IS)
- Ativos: `EquipamentosPage.tsx`, `BoardAtivos.tsx`, `DrawerDetalheAtivo.tsx` (E01-S78/S79).
- OS ricas com técnico/data/check-in-out (E01-S38) em `pcm.ordens_servico`; vínculo OS↔equipamento
  Auvo em `pcm.os_equipamentos_auvo` (E01-S16). Sistema↔Componentes no PCM (E01-S85/S86).

## Critérios de aceite

### AC-1: Histórico de OS por equipamento
- **Dado** um equipamento
- **Quando** o usuário abre seu detalhe
- **Então** vê a lista das OS executadas naquele equipamento (data, tipo, status, técnico) ordenada
  da mais recente, e a **data da última manutenção/preventiva** em destaque.

### AC-2: Histórico de OS por sistema
- **Dado** um sistema
- **Quando** o usuário abre seu detalhe
- **Então** vê o histórico de OS do sistema — incluindo OS abertas para o sistema inteiro e,
  agregadas, as dos seus componentes (deduplicadas), com a última preventiva em destaque.

### AC-3: Sem histórico
- **Dado** um ativo sem OS registrada
- **Quando** o detalhe abre
- **Então** exibe estado vazio claro ("sem manutenções registradas"), sem erro.

## Fora de escopo (vinculante)
- Editar/criar OS a partir do detalhe (só leitura de histórico nesta story).
- Indicadores agregados de frota/planejamento (é dashboard, outra story).

## Rastreabilidade
- `apps/web/src/features/pcm/components/DrawerDetalheAtivo.tsx`, `EquipamentosPage.tsx`
- Domínio novo de histórico do ativo (função pura de agregação/dedupe)
- Fontes: `pcm.ordens_servico` (E01-S38), `pcm.os_equipamentos_auvo` (E01-S16), vínculo
  Sistema↔Componentes (E01-S85/S86)
