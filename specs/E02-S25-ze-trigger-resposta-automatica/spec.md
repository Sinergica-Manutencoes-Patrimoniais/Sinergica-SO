---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Trigger de resposta automática do Zé

> **Fonte da verdade.** Status: rascunho
> Origem: reunião Fabrício × Lucas (2026-07-27). Item 3.

## Resumo
O Zé responde automaticamente ao cliente em duas situações: **fora do horário comercial** e
**após X tempo sem resposta humana** durante o dia. O modelo é **unilateral**: um trigger ativa a
IA (assume a conversa) e um trigger separado a desativa (handoff para humano quando o cliente pede
para falar com uma pessoa). A regra é **global** — mesma configuração para todos os clientes.

## Decisões travadas (reunião)
- **Regra global**, não por cliente (Fabrício: "regra global").
- Modelo **unilateral**: ativa de um lado, desativa do outro.
  - Trigger de **ativação da IA**: fora do horário definido **OU** X minutos sem resposta humana.
  - Trigger de **desativação (handoff → humano)**: cliente sinaliza que quer falar com pessoa
    (ex.: "quero falar com o Fabrício"). A partir daí a IA para de responder aquela conversa.
- Motivação (Fabrício): conversa sempre entra para atendimento humano; a IA cobre lacunas (fora de
  horário, demora), para não perder o cliente por ausência de resposta.

## Parâmetros a definir
- **Horário comercial** (janela em que humanos respondem). Default proposto: 08:00–18:00, seg–sex.
- **X = minutos sem resposta humana** que dispara a IA no horário comercial. Default proposto:
  30 min. Confirmar ambos com Lucas/Fabrício antes de implementar.

## Critérios de aceite

### AC-1: Ativação fora de horário
- **Dado** a regra global configurada e uma mensagem recebida do cliente fora do horário comercial
- **Quando** a mensagem chega
- **Então** o Zé responde automaticamente (sem precisar ser mencionado).

### AC-2: Ativação por inatividade humana
- **Dado** uma mensagem do cliente recebida **dentro** do horário comercial
- **Quando** nenhum humano responde dentro de `X` minutos
- **Então** o Zé assume e responde automaticamente.

### AC-3: Desativação por handoff (unilateral)
- **Dado** uma conversa em que a IA está ativa
- **Quando** o cliente pede explicitamente para falar com um humano
- **Então** o Zé faz handoff, marca a conversa como "atendimento humano" e **para de responder**
  automaticamente até que o trigger de ativação volte a valer.

### AC-4: Não sobrepõe atendimento humano ativo
- **Dado** um humano respondendo ativamente dentro do horário comercial (última resposta humana há
  menos de `X` minutos)
- **Quando** o cliente manda nova mensagem
- **Então** o Zé **não** responde automaticamente (deixa o humano conduzir).

### AC-5: Configuração global única
- **Dado** a configuração de horário e `X`
- **Quando** aplicada
- **Então** ela vale para todos os clientes/instâncias igualmente (não há override por cliente).

## Matriz de decisão
| Horário   | Última resposta humana | Cliente pediu humano? | Resultado          | AC   |
|-----------|------------------------|-----------------------|--------------------|------|
| Fora      | qualquer               | não                   | IA responde        | AC-1 |
| Comercial | > X min                | não                   | IA responde        | AC-2 |
| Comercial | ≤ X min                | não                   | IA silencia        | AC-4 |
| qualquer  | qualquer               | sim (handoff ativo)   | IA silencia        | AC-3 |

## Casos de borda e erros
- Cliente pede humano fora do horário → handoff registrado, mas IA pode enviar uma mensagem de
  "fora do horário, retornamos amanhã" (decidir na implementação; default: envia aviso e silencia).
- Feriado / fim de semana → tratado como "fora de horário" (usar a janela seg–sex do default).
- Reativação após handoff → definir gatilho de volta ao automático (default: próxima janela de
  ativação por horário/inatividade; humano pode reabrir manualmente).

## Fora de escopo
- Configuração por cliente (explicitamente descartado — regra global).
- Conteúdo/qualidade da resposta da IA e memória por cliente (é a E02-S24).
- Abertura de chamado a partir da conversa (é a E02-S23).

## Rastreabilidade
- Edge Function: `supabase/functions/pcm-ze-agent/index.ts`.
- Atendimento multi-instância: E02-S22 (`features/atendimento/`).
- Feature de IA/LLM → trilha `ia/` com `@prompt-engineer`.
- ADRs relacionados: —
