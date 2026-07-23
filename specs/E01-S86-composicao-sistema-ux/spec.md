---
name: spec-E01-S86-composicao-sistema-ux
description: Contrato — UX de composição de Sistema por seleção em checkbox com filtro por nome, disponível no PCM e na Visão 360 (Portal do Cliente).
alwaysApply: true
tier: pequeno
---

# Spec — Composição de Sistema (checkbox + filtro por nome)

> **Fonte da verdade.** Status: aprovado
> Origem: reunião Lucas × Fabrício (2026-07-16), item 2.2. "Na parte de associar itens em um sistema
> precisa melhorar a experiência. Poder adicionar no modelo de checkbox filtrando pelo nome. Isso
> deve ser possível de fazer também dentro da área do cliente no 360."

## Resumo
Melhora a UX de **compor um Sistema** (associar componentes/equipamentos): lista de itens com
**checkbox** e **campo de filtro por nome**, em vez do fluxo atual. O mesmo seletor fica disponível
tanto no PCM quanto na Visão 360 do Cliente.

## Contexto atual (AS-IS)
- Sistema = conjunto de componentes (E01-S85/S76). Composição hoje é trabalhosa.
- Visão 360: `VisaoClientePage.tsx` + `cliente-360-gateway.ts`.
- Equipamentos/ativos: `EquipamentosPage.tsx`, `BoardAtivos.tsx`.

## Critérios de aceite

### AC-1: Seletor por checkbox com filtro
- **Dado** a tela de composição de um Sistema
- **Quando** o usuário abre o seletor de itens
- **Então** vê a lista de itens candidatos com checkbox e um campo de filtro que reduz a lista por
  nome em tempo real; marcar/desmarcar adiciona/remove o item do sistema; salvar persiste a composição.

### AC-2: Disponível na Visão 360
- **Dado** a Visão 360 do Cliente (com `pcm:escrita`)
- **Quando** o usuário compõe/edita um Sistema daquele cliente
- **Então** usa o mesmo componente de seleção (checkbox + filtro), com o mesmo comportamento do PCM.

### AC-3: Consistência com o vínculo Sistema↔Componentes
- **Dado** um item já pertencente ao sistema
- **Quando** o seletor abre
- **Então** ele aparece marcado; a composição resultante é a fonte do vínculo (E01-S85 usa esse
  vínculo para o sync agregado ao Auvo).

## Fora de escopo (vinculante)
- Sync ao Auvo (é E01-S85).
- Criar/editar os itens em si (só associá-los ao sistema).

## Rastreabilidade
- Componente compartilhado de seleção (novo) em `apps/web/src/features/pcm/components/`
- `apps/web/src/features/pcm/pages/EquipamentosPage.tsx` / `BoardAtivos.tsx` (PCM)
- `apps/web/src/features/pcm/pages/VisaoClientePage.tsx` + `application/cliente-360-gateway.ts` (360)
- Domínio do vínculo Sistema↔Componentes (E01-S76/S85)
