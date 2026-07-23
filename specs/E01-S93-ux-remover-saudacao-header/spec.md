---
name: spec-E01-S93-ux-remover-saudacao-header
description: Contrato — remover a saudação personalizada ("Olá, {nome}") do header, que ocupa espaço no mobile.
alwaysApply: true
tier: trivial
---

# Spec — Remover saudação "Olá" do header

> **Fonte da verdade.** Status: aprovado
> Origem: reunião Lucas × Fabrício (2026-07-16), item 9.1. "É para tirar, porque quando fui usar no
> celular, ele tomou um espaço legal."

## Resumo
Remover a saudação personalizada ("Olá, Fabrício") do header — ganha espaço, sobretudo no mobile.

## Critérios de aceite

### AC-1: Sem saudação no header
- **Dado** qualquer tela com o header
- **Quando** renderiza (desktop e mobile)
- **Então** não há mais o texto "Olá, {nome}"; o espaço é recuperado. O identificador do usuário
  (avatar/menu de conta) permanece disponível para logout/perfil.

## Fora de escopo (vinculante)
- Redesenho do header além de remover a saudação.
- Menu de conta/logout (permanece como está).

## Rastreabilidade
- `apps/web/src/app/HomePage.tsx` (header/greeting)
