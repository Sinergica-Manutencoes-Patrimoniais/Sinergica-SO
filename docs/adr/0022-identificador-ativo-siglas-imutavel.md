---
name: ADR-0022
description: Identificador de ativo (Componente/Sistema) gerado por siglas de 3 caracteres na criação pelo SO e imutável depois; "Componente" como nome de UI de pcm.equipamentos.
alwaysApply: false
---

# ADR-0022 — Identificador de ativo por siglas, gerado uma vez e imutável

**Status:** Aceito
**Data:** 2026-09-29
**Decisores:** Lucas (PO)
**Relacionados:** ADR-0006, ADR-0009, ADR-0012 · `specs/E01-S155-posicao-flexivel-ativos/design.md` · E01-S154, E01-S157

## Contexto
O identificador do Equipment no Auvo é o que o técnico lê no app e o que o QR Code colado no ativo
aponta. Hoje ele é texto livre ou um número gerado pelo Auvo (ex.: `5979161820767703`), que não diz
nada ao técnico. A Sinérgica quer um código legível que carregue o caminho do ativo. A decisão é
difícil de reverter: depois que etiquetas QR forem impressas e coladas, mudar a regra significa
reetiquetar prédios.

Além disso, o SO chama de "Equipamento" o que a Sinérgica chama de **Componente**. "Equipamento" é
o nome da entidade no Auvo, e a mesma palavra para duas coisas gera confusão.

## Decisão
1. Identificador = `CLI[-ARE][-LOC...]-CAT-NOM-NN`, com blocos de **exatamente 3** caracteres
   `[A-Z0-9]` e sequencial de 2 dígitos (ou o número que já está no fim do nome). Exemplo:
   `GUA-TOA-A02-SHA-ELE-QDC-01`. Algoritmo em `design.md`.
2. Gerado **somente** quando o Componente/Sistema é criado **pelo SO**. Item criado no Auvo mantém
   o identificador do Auvo.
3. Depois de criado, o identificador é **imutável por regra de sistema**. Mudar sigla, posição,
   categoria ou nome não o recalcula. Alteração manual é permitida só depois de uma confirmação
   que avisa que o QR Code impresso deixa de corresponder.
4. Siglas ficam gravadas em `clientes`, `areas`, `locais` e `equipamento_categorias`. São
   sugeridas automaticamente, editáveis e únicas entre irmãos.
5. "Componente" é o nome de **UI e glossário** para a linha de `pcm.equipamentos`. Tabela, tipos
   TypeScript e descriptor mantêm `equipamento` (nome físico, ADR-0009).

## Alternativas consideradas
| Alternativa | Prós | Contras | Por que (não) escolhida |
|---|---|---|---|
| Siglas + imutável (escolhida) | legível; QR estável | identificador pode "mentir" depois que o item muda de lugar | QR estável vale mais que código sempre atualizado |
| Recalcular sempre que a posição muda | código sempre fiel | quebra QR impresso a cada mudança | rejeitada pelo PO |
| Manter numérico do Auvo | zero esforço | ilegível | não resolve o problema |
| Blocos de tamanho livre (`TA`, `ELEC`) | mais natural | tamanho imprevisível, difícil de validar | PO escolheu 3 fixos |
| Renomear tabela para `componentes` | linguagem alinhada no código | refactor amplo, risco no pipeline Auvo | custo sem ganho para o usuário |

## Consequências
**Positivas:**
- O técnico entende o código sem abrir o app.
- O QR Code nunca quebra sem alguém ter confirmado a mudança.
- A regra é determinística e testável (casos de ouro no design).

**Negativas / trade-offs aceitos:**
- Um item movido de lugar mantém o código antigo. A descrição no Auvo (E01-S158) mostra o caminho
  atual.
- Itens legados (~2000) e itens criados no Auvo ficam fora do padrão até alguém editá-los à mão.
- O código diz "Equipamento" e a UI diz "Componente". O glossário documenta o mapeamento.
