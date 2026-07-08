---
name: spec
description: Contrato — aba de config "Operação" (motores tool-use/RAG/vendas/pedidos + regras), paridade heziomos.
alwaysApply: true
---

# Spec — Aba de config: Operação

> **Fonte da verdade.** Status: rascunho · Tier: Pequeno-Médio (aba de config mais rica)
> É a aba "Operação" do heziomos (print): toggles de motores + sub-cards de governança do agente.

## Resumo
A aba "Operação" controla os motores do agente (Ferramentas/tool use, Busca por relevância/RAG, Modo
vendas, Consulta de pedidos) e as regras de atendimento (limites, transferência, orçamento, lições,
especialistas), persistidos por agente/cliente.

## Critérios de aceite

### AC-1: Toggles dos motores com dependências
- **Dado** a aba Operação
- **Quando** o usuário liga/desliga `Ferramentas`, `Busca por relevância (RAG)`, `Modo vendas`, `Consulta de pedidos`
- **Então** os estados persistem; `Modo vendas` exige `Ferramentas` ligado (dependência refletida na UI e validada no back)

### AC-2: Regras de atendimento
- **Dado** o sub-card "Regras de atendimento"
- **Quando** o usuário define limite diário, "transferir após N respostas" e palavras que transferem
- **Então** os valores persistem e ficam disponíveis para o motor do agente

### AC-3: Orçamento, lições e especialistas
- **Dado** os sub-cards Orçamento do mês, Lições aprendidas e Especialistas
- **Quando** editados
- **Então** persistem por agente (orçamento mensal, correções/lições, links de especialistas)

### AC-4: Gating por papel
- **Dado** usuário sem permissão de config
- **Quando** acessa/salva
- **Então** é bloqueado (RLS + gate de UI)

## Matriz de decisão
| Ferramentas | Modo vendas (pedido) | Resultado | AC |
|-------------|----------------------|-----------|----|
| off | ligar | bloqueado, exige Ferramentas | AC-1 |
| on | on | vendas ativo | AC-1 |

## Casos de borda e erros
- Desligar `Ferramentas` com `Modo vendas` ligado → desliga vendas junto (ou bloqueia), documentado.
- Palavras-gatilho vazias → transferência por palavra desativada, não erro.

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Identidade/modelo do agente — `E02-S13`. Base de conhecimento/RAG data — `E02-S15`.

## Rastreabilidade
- Product: `./product.md`
- Referência heziomos: `AgentOperationTab` (toggles + `RulesCard`/`BudgetCard`/`LessonsCard`/`SpecialistsCard`).
- Âncora Sinergica: `AtendimentoConfigPage.tsx`, `supabase-config-adapter.ts`.
