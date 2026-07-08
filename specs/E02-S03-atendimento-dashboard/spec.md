---
name: spec
description: Contrato — Dashboard de Atendimento (KPIs read-only).
alwaysApply: true
---

# Spec — Dashboard de Atendimento

> **Fonte da verdade.** Status: aprovado · Tier: Pequeno

## Critérios de aceite

### AC-1: KPIs batem com contagem real
- **Dado** conversas reais em `atendimento.conversas`
- **Quando** o dashboard carrega
- **Então** "Conversas abertas"/"não lidas"/"assumidas por humano" batem com `status`/`nao_lidas`/
  `modo` das linhas (validação cruzada manual)

### AC-2: Autonomia da IA não divide por zero
- **Dado** nenhuma mensagem de saída registrada ainda
- **Quando** o dashboard calcula autonomia
- **Então** mostra "—" em vez de erro ou `NaN%`

### AC-3: Painel não escreve nada
- **Dado** qualquer estado da tela
- **Quando** inspecionado o código
- **Então** não há nenhuma chamada de insert/update/delete (auditável por grep, mesmo padrão de
  outras telas read-only do projeto)

### AC-4: Gate de permissão
- **Dado** um usuário sem `atendimento` liberado
- **Quando** acessa o Dashboard
- **Então** vê a tela de acesso restrito, mesmo padrão do resto do módulo

## Fora de escopo
- Ver `product.md` → Non-goals.
