---
name: spec-E01-S85-sync-ativos-localizacao-auvo
description: Contrato — localização Auvo = Área+Local+Sublocal concatenado (ajustável, espelhado nos edits/moves) e Sistema como equipamento agregado no Auvo.
alwaysApply: true
tier: arquitetural
---

# Spec — Sync de ativos PCM↔Auvo: localização + sistema

> **Fonte da verdade.** Status: aprovado (após `design.md`)
> Origem: reunião Lucas × Fabrício (2026-07-16), itens 2.1 e 2.3.
> Depende de `./design.md` aprovado.

## Resumo
No Auvo, a localização de um ativo é a **concatenação `Área + Local + Sublocal`** (ex.: "Torre A ·
1º andar · Sala 001"), com formato ajustável; edições e movimentações no PCM refletem no Auvo. Cada
**Sistema** é cadastrado no Auvo como **um equipamento agregado** (além dos equipamentos/componentes
que fizerem sentido), com o vínculo Sistema↔Componentes vivendo no PCM.

## Critérios de aceite

### AC-1: Localização concatenada montada do PCM
- **Dado** um ativo com Área/Local/Sublocal no PCM
- **Quando** é sincronizado ao Auvo
- **Então** a localização enviada é `Área <sep> Local <sep> Sublocal` (função pura de domínio),
  com separador/ordem **configuráveis**.

### AC-2: Edição de nome propaga ao Auvo
- **Dado** um ativo já espelhado no Auvo
- **Quando** o usuário renomeia a Área/Local/Sublocal no PCM
- **Então** a localização de **todos** os ativos afetados é re-enfileirada e atualizada no Auvo
  (PATCH via outbox), sem edição manual item a item.

### AC-3: Mover ativo propaga ao Auvo
- **Dado** o Board (E01-S78/S79) com drag-and-drop de local
- **Quando** o usuário move um ativo para outro Local/Sublocal
- **Então** a localização do ativo é recalculada e sincronizada ao Auvo.

### AC-4: Sistema como equipamento agregado no Auvo
- **Dado** um Sistema (conjunto de componentes) no PCM
- **Quando** é sincronizado
- **Então** ele sobe ao Auvo como **um** equipamento agregado (não um por componente); os
  componentes individuais **não** são criados como equipamentos no Auvo por padrão; o vínculo
  Sistema↔Componentes permanece no PCM.

### AC-5: Escrita real gated por verificação
- **Dado** o motor de sync
- **Quando** a escrita real (`writeEnabled`) ainda não foi verificada campo a campo (E01-S36)
- **Então** o caminho opera em dry-run/documentado — **nunca** grava dado malformado na conta Auvo de
  produção sem verificação.

## Fora de escopo (vinculante)
- Subir cada componente como equipamento no Auvo (fica opt-in, fora deste MVP).
- Localização estruturada/hierárquica no Auvo (Auvo não suporta).
- Motor de sync novo (reusa E01-S22/S23/S36).

## Rastreabilidade
- Design: `./design.md` · ADR: atualiza ADR-0006 (sistema agregado)
- Domínio: `apps/web/src/features/pcm/domain/` (concatenação de localização, função pura)
- Motor: entity registry + `supabase/functions/pcm-auvo-push/`, outbox `pcm.auvo_sync_outbox`
- Trigger de re-enfileiramento em rename/move (migration)
- Board: `apps/web/src/features/pcm/components/BoardAtivos.tsx` (move dispara sync)
