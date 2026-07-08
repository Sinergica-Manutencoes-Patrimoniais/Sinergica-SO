---
name: spec
description: Contrato — aba de config "IA" (identidade/modelo/número/agenda do agente), paridade heziomos.
alwaysApply: true
---

# Spec — Aba de config: IA

> **Fonte da verdade.** Status: rascunho · Tier: Pequeno
> Uma das 15 abas do heziomos ausentes no Sinergica. Padrão de aba: nova `TabId` em
> `AtendimentoConfigPage.tsx` + tipo em `domain/` + use-cases em `application/` + adapter Supabase +
> migration (tabela + RLS FORCE + grant service_role) + gating por role/feature-flag.

## Resumo
A aba "IA" permite configurar a identidade do agente, o modelo LLM, o número/canal e a janela de
atendimento, persistindo por cliente/instância.

## Critérios de aceite

### AC-1: Editar identidade e modelo
- **Dado** a aba IA aberta
- **Quando** o usuário edita identidade (nome/persona base), modelo LLM e número/canal e salva
- **Então** os valores persistem (tabela dedicada, RLS FORCE) e recarregam na próxima abertura

### AC-2: Janela de atendimento
- **Dado** os horários de atendimento
- **Quando** configurados
- **Então** são salvos e usados como referência pelo agente (fora da janela ≠ dentro)

### AC-3: Gating por papel
- **Dado** um usuário sem permissão de config de Atendimento
- **Quando** tenta abrir/salvar a aba
- **Então** é bloqueado (RLS + gate de UI), igual ao gating de abas do heziomos

## Casos de borda e erros
- Modelo inválido/indisponível → validação impede salvar com mensagem clara.
- Cliente sem config ainda → estado default, não erro.

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Motores de operação (tool use/RAG/vendas) — `E02-S14`.
- Base de conhecimento — `E02-S15`.

## Rastreabilidade
- Product: `./product.md`
- Referência heziomos: `AISettingsTab`.
- Âncora Sinergica: `features/atendimento/pages/AtendimentoConfigPage.tsx`, `infrastructure/supabase-config-adapter.ts`.
