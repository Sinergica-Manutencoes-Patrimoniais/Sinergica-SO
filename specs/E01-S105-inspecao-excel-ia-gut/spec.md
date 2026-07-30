---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Inspeção: Excel → IA quebra linhas → GUT → fluxo de chamado

> **Fonte da verdade.** Status: rascunho
> Origem: reunião Fabrício × Lucas (2026-07-27). Item 15.

## Resumo
O levantamento de inspeção chega em uma planilha Excel. A IA **quebra e trata** cada linha do Excel
em itens de inspeção estruturados, cada item passa pela **priorização GUT** e entra no **fluxo de
chamado** existente (item de inspeção pode derivar Chamado — já suportado por E01-S90). Estende as
capacidades de inspeção/assessment já existentes (E01-S90, E01-S98).

## Decisões travadas (reunião)
- Fabrício quer a IA presente no processo de inspeção ("gostaria que a IA tivesse nesse processo
  todo"), como copiloto.
- Fluxo: **Excel com todo o levantamento → IA quebra linha e trata → GUT → fluxo de chamado.**

## Critérios de aceite

### AC-1: Importar Excel de levantamento
- **Dado** uma planilha Excel de inspeção
- **Quando** o operador faz upload
- **Então** o sistema lê as linhas e apresenta um preview do que será processado; **e** erros de
  parsing exibem mensagem específica (não genérica — reaproveitar aprendizado de E01-S96).

### AC-2: IA quebra e trata cada linha em item de inspeção
- **Dado** as linhas do Excel importado
- **Quando** a IA processa
- **Então** cada linha vira um item de inspeção estruturado (descrição normalizada, local, e demais
  campos que a IA conseguir inferir), um item por linha/solicitação distinta.

### AC-3: Priorização GUT por item
- **Dado** os itens tratados pela IA
- **Quando** exibidos para priorização
- **Então** cada item recebe GUT (Gravidade/Urgência/Tendência) — sugerido pela IA e editável pelo
  operador — coerente com o mecanismo GUT existente (E01-S82/S94).

### AC-4: Entrada no fluxo de chamado
- **Dado** itens de inspeção priorizados
- **Quando** o operador confirma
- **Então** cada item pode derivar um Chamado (`origem = "inspecao"`, com `origemInspecaoItemId`),
  entrando no fluxo padrão de tratamento → OS.

### AC-5: Revisão humana antes de gravar
- **Dado** o resultado da IA (itens + GUT sugerido)
- **Quando** apresentado
- **Então** nada é gravado como chamado sem o operador revisar/confirmar (a IA é copiloto, não
  executor autônomo).

## Casos de borda e erros
- Excel com formato/colunas inesperadas → erro específico indicando o que faltou (não genérico).
- Linha vazia ou irrelevante → IA descarta e sinaliza no preview (operador pode reincluir).
- Falha da IA/OpenRouter → degrada para importação bruta (linhas sem tratamento) com aviso, sem
  perder os dados.

## Fora de escopo
- Geração de OS (fluxo posterior já existente).
- Galeria de fotos do item (E01-S97) e análise de questionário de assessment (E01-S98) — separadas.

## Rastreabilidade
- Código: inspeção/assessment em `apps/web/src/features/pcm/` (E01-S90, E01-S98).
- Feature de IA/LLM → trilha `ia/` (prompt versionado, eval, injection) com `@prompt-engineer`.
- ADRs relacionados: —
