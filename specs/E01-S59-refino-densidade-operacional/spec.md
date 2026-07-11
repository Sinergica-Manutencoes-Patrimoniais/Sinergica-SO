---
name: refino-densidade-operacional
description: Refinar densidade, hierarquia e contexto das telas operacionais PCM.
alwaysApply: true
---

# Spec — Refino de densidade operacional PCM

> **Fonte da verdade.** Status: implementado localmente

## Resumo
As telas de OS e dashboard passam a usar melhor o espaço disponível, exibir contexto operacional
útil e consolidar sinais Auvo vindos tanto de pull quanto de webhook.

## Critérios de aceite

### AC-1: Densidade visual consistente
- **Dado** o shell e os formulários do PCM
- **Quando** uma tela operacional é exibida em desktop
- **Então** cabeçalho, espaçamentos, botões, inputs e cartões usam a escala compacta existente sem
  reduzir a legibilidade ou criar tokens paralelos

### AC-2: Fila de OS ocupa a largura disponível
- **Dado** a visão Lista de Ordens de Serviço
- **Quando** há ordens carregadas
- **Então** cada linha ocupa toda a coluna, o bloco possui título e contagem, e a OS selecionada
  tem estado visual e semântico explícito

### AC-3: Resumo da OS traz contexto útil
- **Dado** uma OS selecionada
- **Quando** o painel de detalhe é exibido
- **Então** ele mostra descrição, técnico, cliente e dados operacionais disponíveis em uma
  hierarquia compacta, sem reservar grandes áreas vazias

### AC-4: Dashboard operacional condensado
- **Dado** o dashboard PCM em desktop
- **Quando** KPIs e blocos Auvo são exibidos
- **Então** mais indicadores cabem por linha, com números e ações em escala compacta e sem perda
  de contraste ou informação

### AC-5: Listas do dashboard explicam as OS
- **Dado** Top Backlog e Ordens Recentes
- **Quando** o usuário lê ou passa o foco/ponteiro sobre uma OS
- **Então** número, cliente, categoria, técnico, descrição e contexto disponível ficam acessíveis
  na própria linha ou no tooltip

### AC-6: Sinais de campo não ignoram o pull
- **Dado** que `auvo_task_snapshots` pode estar vazio e `ordens_servico.auvo_detalhes` contém
  evidências trazidas pelo pull
- **Quando** o dashboard calcula sinais de execução
- **Então** ele consolida ambas as fontes por OS, sem duplicidade, e mantém zero somente para o
  sinal realmente ausente

## Casos de borda e erros
- OS sem descrição ou técnico mantém fallback curto, sem bloco vazio.
- Snapshot sem `ordem_servico_id` continua contado como evento independente.
- Detalhe JSON malformado ou duração não numérica é ignorado sem derrubar o dashboard.
- Layout preserva empilhamento em viewport estreito.

## Fora de escopo
- Redesign completo dos módulos Atendimento, Comercial, Financeiro e Marketing.
- Inventar dados de checklist, peças ou GPS ausentes nas fontes reais.
- Alterar regras de status, GUT, sincronização ou permissões.

## Rastreabilidade
- ADRs relacionados: `docs/adr/0001-pcm-origin-truth-externalid.md`
