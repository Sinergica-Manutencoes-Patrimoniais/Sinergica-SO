---
name: spec
description: Contrato — dashboard comercial com conversão por etapa, ciclo de venda, ticket médio, win/loss por motivo e desconto médio × piso.
alwaysApply: true
---

# Spec — E03-S08 · Dashboard comercial

> **Fonte da verdade.** Status: pronto para implementar · Tier: **pequeno**
> Depende de **E03-S02** (funil com eventos). Métricas mais ricas ficam melhores com S04/S07
> implementadas, mas o dashboard **degrada honestamente** sem elas.
> Agregação **server-side** por RPC, padrão da E04-S03.

## Resumo
Responde a pergunta que originou o épico: *o funil está funcionando?* Conversão por etapa, ciclo de
venda, ticket médio, win/loss por motivo, desconto médio contra o piso e origem do lead — tudo
calculado no banco, a partir de `oportunidade_eventos` (a fonte real), nunca por diferença de
datas na tela.

## Critérios de aceite

### AC-1: Agregação server-side
- **Dado** o volume de oportunidades
- **Quando** o dashboard carrega
- **Então** os números vêm de RPCs (`security invoker` ou `definer` com guarda de permissão,
  padrão E04-S03/E04-S06), **não** de `select` de todas as linhas agregado no browser

### AC-2: Conversão por etapa
- **Dado** um período selecionado
- **Quando** o usuário vê a conversão
- **Então** mostra, para cada etapa, quantas oportunidades **entraram** e quantas **avançaram**
  para a etapa seguinte, com o percentual — calculado a partir de `oportunidade_eventos`

### AC-3: Ciclo de venda vem dos eventos
- **Dado** oportunidades fechadas no período
- **Quando** o ciclo de venda é exibido
- **Então** é a mediana (não a média — outlier distorce) de `fechada_em − criada_em`, derivada dos
  eventos; oportunidades ainda abertas **não** entram no cálculo

### AC-4: Win/loss por motivo
- **Dado** oportunidades em etapas `ganha` e `perdida` no período
- **Quando** o usuário vê win/loss
- **Então** mostra a taxa de ganho e a distribuição das perdas **por motivo** — é a métrica que
  justifica o motivo obrigatório do AC-6 da S01

### AC-5: Ticket médio
- **Dado** oportunidades ganhas no período
- **Quando** o ticket médio é exibido
- **Então** usa o valor do **contrato** quando existir (S07), caindo para o valor da proposta
  aceita (S04) e depois para o `valor_estimado` da oportunidade — indicando qual fonte foi usada

### AC-6: Desconto médio contra o piso
- **Dado** propostas enviadas no período (S04)
- **Quando** o desconto médio é exibido
- **Então** mostra a média de `1 − (preço ÷ preço sugerido)` e **quantas propostas ficaram a menos
  de 5% do piso** — o sinal de que a margem está sendo corroída

### AC-7: Origem do lead
- **Dado** oportunidades com `origem` preenchida
- **Quando** o usuário vê a distribuição por origem
- **Então** mostra volume e taxa de conversão por origem, com um agrupamento explícito
  "sem origem" — nunca escondendo o que não foi classificado

### AC-8: Degrada honestamente sem as stories seguintes
- **Dado** que S04/S07 ainda não foram implementadas
- **Quando** o dashboard carrega
- **Então** os blocos de desconto e ticket por contrato aparecem com aviso de "sem dados ainda",
  **nunca** com zero apresentado como se fosse resultado real (mesmo padrão honesto de
  `pcm.despesas` na E04-S06)

### AC-9: Período vazio não quebra
- **Dado** um período sem nenhuma oportunidade
- **Quando** o dashboard carrega
- **Então** exibe estado vazio explícito em cada bloco, sem erro, sem divisão por zero e sem `NaN`

### AC-10: Gate de permissão
- **Dado** um usuário sem o módulo `comercial`
- **Quando** tenta acessar
- **Então** a rota é negada e o item não aparece na sidebar; com `leitura` o dashboard abre normal
  (é só leitura)

## Casos de borda e erros
- **Oportunidade que pulou etapas** (arrastada direto para `ganha`) → conta na conversão como
  passagem pelas etapas puladas? **Não**: conversão usa transições reais registradas.
- **Oportunidade reaberta** → o ciclo usa o **último** fechamento.
- **Etapa renomeada** → as métricas seguem o `tipo` (`aberta`/`ganha`/`perdida`), não o nome — foi
  para isso que o `tipo` existe (S01, AC-2).
- **Etapa excluída** (só desativada é possível) → eventos históricos preservam o nome no momento.
- **Uma única oportunidade no período** → mediana = ela mesma; exibir com aviso de amostra pequena
  (padrão `amostraPequena` da E04-S13).

## Fora de escopo
- **Previsão/forecast ponderado por etapa.**
- **Metas de vendas e acompanhamento contra meta.**
- **Comissionamento.**
- **Atribuição por campanha/anúncio** — é E06/E07; aqui `origem` é campo simples.
- **Exportação CSV** — se fizer falta, reusa o padrão da E04-S11.

## Rastreabilidade
- Épico: `../E03-S01-fundacao-comercial/product.md` (tabela de métricas de sucesso)
- Fonte dos dados: `comercial.oportunidade_eventos` (S01/S02), `propostas` (S04), `contratos` (S07)
- Padrão: E04-S03 (RPC + gráficos SVG próprios), E04-S13 (`amostraPequena`)
