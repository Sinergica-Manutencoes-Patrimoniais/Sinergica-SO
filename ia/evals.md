---
name: ia-evals
description: Como medir qualidade de feature LLM (eval harness). Puxe ao definir/rodar evals.
alwaysApply: false
---

# Evals — o "teste" de uma feature LLM

Saída de LLM é não determinística, então `expect(x).toBe(y)` não basta. **Eval** é um conjunto de
casos (entrada → critério de sucesso) que mede a qualidade da saída. É o **gate** da feature de IA.

## Estrutura mínima
- **Dataset de casos:** entradas representativas + casos de borda + **casos adversariais**
  (tentativas de injection). Cada caso ligado a um `AC` da spec quando possível.
- **Critério por caso:** o que conta como sucesso. Escolha o mais barato que sirva:
  - **Determinístico** (preferido): a saída contém/iguala/valida contra schema (ex.: JSON válido,
    campo correto, classificação exata).
  - **Assertivo por regra:** regex, presença/ausência de termo, faixa numérica.
  - **LLM-as-judge** (quando subjetivo): um LLM avalia a saída contra uma rubrica. Use só quando
    necessário; a rubrica também é versionada.
- **Limiar (threshold):** % mínima de casos que devem passar para a feature ser considerada pronta
  (ex.: 95% dos casos determinísticos, 0 falha em casos adversariais).

## Onde ficam
`ia/evals/<feature>/` com o dataset e o runner. O comando de eval entra como **gate** no
`tasks.md` da feature (coluna "Gate") e no CI quando o custo permitir.

## Regras
- **Caso adversarial é obrigatório** em feature que recebe texto livre do usuário (testa LLM01).
- Eval roda em modelo/versão fixos; ao trocar de modelo, **rode o eval de novo** (regressão).
- Registre baseline e meta como em `product.md` (ex.: acurácia hoje X → alvo Y).
