---
name: acabamento-visual-v1
description: Contrato de acabamento visual transversal para a navegação V1.
alwaysApply: true
---

# Spec — Acabamento visual V1

> **Fonte da verdade.** Status: implementado localmente

## Resumo
As telas navegáveis da V1 passam a compartilhar densidade, hierarquia, estados e responsividade
coerentes, preservando desempenho, segurança e identidade visual da Sinérgica.

## Critérios de aceite

### AC-1: Sistema visual compartilhado
- **Dado** Login, Início, PCM, Atendimento e Configurações
- **Quando** cabeçalhos, cartões, botões, campos, abas e estados são renderizados
- **Então** usam uma escala compartilhada de densidade, foco, borda, sombra e tipografia sem criar
  dependência externa ou cor fora dos tokens sem função semântica

### AC-2: Navegação desktop refinada
- **Dado** uma viewport desktop
- **Quando** o usuário navega entre módulos e páginas
- **Então** shell, sidebar e conteúdo usam melhor a área disponível, preservam hierarquia clara e
  não apresentam controles ou números desproporcionalmente grandes

### AC-3: Navegação compacta responsiva
- **Dado** uma viewport estreita
- **Quando** o usuário acessa a V1
- **Então** a navegação principal permanece acessível, o conteúdo não fica oculto por uma sidebar
  fixa e grids/formulários empilham sem overflow horizontal estrutural

### AC-4: Estados completos e acessíveis
- **Dado** carregamento, vazio, erro, seleção, hover, foco ou ação desabilitada
- **Quando** o estado ocorre
- **Então** há feedback visual legível e navegável por teclado, com contraste e foco perceptíveis

### AC-5: Telas operacionais densas e legíveis
- **Dado** listas, catálogos, dashboards, inbox e configurações com dados reais
- **Quando** exibidos em desktop
- **Então** mais informação útil cabe na primeira dobra sem reduzir texto de corpo abaixo da escala
  legível definida pelo produto

### AC-6: Qualidade de entrega V1
- **Dado** o conjunto de mudanças visuais
- **Quando** os gates são executados
- **Então** testes, typecheck, lint, build e auditoria de dependências não apresentam regressão nova,
  e um smoke autenticado cobre as principais rotas em desktop e viewport estreita

## Casos de borda e erros
- Conteúdo longo deve truncar ou quebrar dentro do próprio cartão, sem alargar a página.
- Modais devem respeitar altura disponível e manter ações acessíveis.
- Páginas sem permissão ou sem dados mantêm orientação curta e ação útil quando aplicável.
- Tema escuro preserva contraste e não usa fundos claros literais para estados sem alternativa.

## Fora de escopo
- Implementar módulos ainda marcados como “em construção”.
- Alterar regras de negócio, integrações, permissões ou schema de banco.
- Introduzir biblioteca visual nova sem necessidade demonstrável.

## Rastreabilidade
- Complementa `specs/E01-S59-refino-densidade-operacional/spec.md`.
- ADRs relacionados: `docs/adr/0001-pcm-origin-truth-externalid.md`.
