---
name: E02-S33-gasto-ia-conversa
description: Exibir custo de IA (USD) de cada resposta na conversa do Atendimento
---

# E02-S33 — Gasto de IA na conversa

## Contexto
Quando supervisor/agente clica "Responder com IA agora" (E02-S01), a Edge Function chama OpenRouter.
Custo **não é visível** — usuário não sabe quanto custou aquela resposta.

Dependência: **E02-S31** (tabela `ia_gasto_log` existe).

## Requisitos

### AC-1: Rodapé com custo
- Bolha de resposta gerada por IA mostra rodapé: `"IA · $0.0042 · 12:34"`
- Formato: "$" + cents arredondado (2 casas), timestamp

### AC-2: Hover com detalhe
- Tooltip ao passar mouse: "Custo de processamento: $X (modelo, tokens in/out)"

### AC-3: Acumulado na conversa
- Badge no topo da conversa: "Total IA: $X.XX" (soma de todas as respostas da conversa)

### AC-4: Sem IA = sem custo
- Mensagens manuais (formulário, celular) **não têm rodapé de custo**
- Evita confusão ("Por que essa não custou nada?")

## Fora de escopo
- Refund / recálculo de custo — apenas exibição
- Filtrar por custo mínimo (AC-3 é apenas info visual)

## Tier
Pequeno (lógica de UI já usa `ia_gasto_log` de S31).

---

## Tarefas

1. **Adapter:** `supabase-historico-chamado-adapter.ts` carrega `ia_gasto_log` por `ref_id` = `interacao.id`
2. **UI:** `HistoricoChamadoInteracao` novo prop `custoDe IA`
3. **UI:** componente `RodapeRespostaIA` (custo + timestamp)
4. **UI:** `ConversaChamado` calcula badge de total
5. **Testes:** Playwright (tooltip, rodapé, badge acumulado)

---

## Validação
- `ci:local` verde
- Smoke: mandar resposta de IA, custo aparece no rodapé
- Playwright: hover tooltip, badge acumulado atualiza
