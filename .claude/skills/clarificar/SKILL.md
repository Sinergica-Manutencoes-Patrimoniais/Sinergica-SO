---
name: clarificar
description: Use para afiar uma spec ambígua antes de implementar — sabatina uma pergunta por vez, caminhando a árvore de decisão, até cada AC ficar testável e não-ambíguo. Agente: @pm. Acione com /clarificar.
---

# Skill: Clarificar (sabatina da spec)

Quando a ambiguidade é **profunda e ramificada** (uma decisão depende da outra), o lote de
perguntas não serve. Esta skill conduz uma **sabatina: uma pergunta por vez**, usando a resposta
para decidir a próxima. **Dono:** `@pm`.

## Como conduzir
1. Liste os pontos vagos da `spec.md` (AC sem resultado observável, "como deveria se comportar
   quando…", casos de borda em aberto, fronteira de escopo difusa).
2. Faça **uma** pergunta por vez (use `AskUserQuestion`), começando pela que mais ramifica o resto.
   Ofereça opções com um default "(Recomendado)" quando houver caminho óbvio.
3. A cada resposta, **escreva de volta** na `spec.md`: vire AC testável, mova item para "Fora de
   escopo", ou registre na matriz de decisão.
4. Pare quando **todo AC for testável e não-ambíguo** (Definition of Ready).

## Regras
- Não decida pelo usuário em ponto de negócio — pergunte.
- Decisão difícil de reverter que aparecer aqui → vira ADR (avise o `@architect`).
- Não invente: se nem o usuário sabe, registre como questão em aberto no `design.md`.
