---
name: plan
description: "Plano técnico de E01-S200 — domínio puro, ligação nos caminhos manuais, flag reversível."
alwaysApply: false
---

# Plano — E01-S200

## Domínio (puro)

`apps/web/src/features/pcm/domain/transicoes-os.ts`:

- `transicaoPermitida(de, para)` devolve `{ permitida, motivo }` — o motivo é frase pronta para a
  tela, nunca vazio numa recusa;
- `destinosPermitidos(de)` alimenta o seletor, para não oferecer o que será recusado depois;
- `ehStatusLegado` / `ehStatusDoFluxoAprovado` separam o fluxo aprovado dos resíduos.

A matriz é uma tabela explícita, não uma regra derivada da ordem das colunas: as idas e voltas do
pacote (devolver para execução, replanejar, adiar) não são deduzíveis de uma sequência linear.

## Interface

- **Arrastar** (`OsKanbanView`): consulta a matriz antes de chamar `onAlterarStatus`; recusa
  aparece em `<output>` no topo do quadro.
- **Seletor, painel de detalhe e lote**: próxima fatia — o seletor passa a ser montado com
  `destinosPermitidos`, o que elimina a recusa antes dela acontecer.

## Reversibilidade

Flag `VITE_SSO_MATRIZ_TRANSICOES_ENABLED`, `false` por padrão. Desligada, o comportamento é
exatamente o de hoje. É a trava que permite ligar na homologação, observar, e desligar em segundos
se algum caminho real for barrado — sem deploy.

## Risco endereçado

O risco que `E01-S194` nomeou era travar caminho legítimo. Três defesas: o inventário dos
chamadores feito antes de escrever a matriz; a automação deliberadamente fora de alcance; e a flag
desligada por padrão.

## SPEC_DEVIATION

- **AC-8 parcial nesta fatia:** a recusa com motivo está no arrastar. Seletor, detalhe e lote ainda
  não consultam a matriz — com a flag desligada por padrão, não há divergência observável em
  produção. Próxima fatia.
