---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — <nome da feature>

> **Fonte da verdade.** Status: rascunho | em review | aprovado | implementado
> Os AC são (a) o contrato com o negócio, (b) o oráculo de teste, (c) o prompt para o agente
> implementar. Escreva-os para serem executáveis.

## Resumo
<Uma frase: o que o sistema passará a fazer.>

## Critérios de aceite
> Formato Given/When/Then. Cada `AC-N` é um ID rastreável: reaparece em `tasks.md` (coluna
> "Cobre AC"), no teste de aceite que o valida e na mensagem de commit. Não renumere ACs já
> implementados.

### AC-1: <título do cenário>
- **Dado** <estado/pré-condição>
- **Quando** <ação/evento>
- **Então** <resultado observável e verificável>

### AC-2: <título>
- **Dado** …
- **Quando** …
- **Então** …

## Matriz de decisão (opcional)
> Use quando a regra combina vários fatores (flags, estados, papéis, modos). Cada linha vira um
> caso de teste. Ligue cada linha ao `AC-N` que ela detalha.

| Fator A | Fator B | … | Resultado esperado | AC   |
|---------|---------|---|--------------------|------|
| <valor> | <valor> | … | <ação observável>  | AC-1 |

## Casos de borda e erros
- <entrada inválida → comportamento esperado>
- <concorrência, timeout, falha de dependência → comportamento esperado>

## Fora de escopo
> Vinculante. Não implemente nada aqui.
- <…>

## Rastreabilidade
- Product: `./product.md` · Design: `./design.md` (se arquitetural) · Domínio: `./domain.md`
- ADRs relacionados: <links>
