---
name: spec
description: Contrato — abrir e editar uma OS clicando no card do Kanban e na linha do Backlog GUT; enriquecer os campos do Backlog. Hoje só troca status.
alwaysApply: true
---

# Spec — E01-S69 · OS clicável e editável (Kanban + Backlog + Lista)

> **Fonte da verdade.** Status: pronto para implementar · Tier: médio
> Origem: teste de produção do Lucas (2026-07-14) — "OS no Kanban não é clicável pra abrir/editar";
> "Backlog GUT não é clicável pra editar e está pobre de informações".

## Problema (confirmado no código)
- **Kanban** (`OsKanbanView.tsx:97-119`): o card só **seleciona** a OS (`onSelecionar`) → renderiza
  um painel read-only `DetalheOs` abaixo do board. Não abre modal, não edita campos (só status via
  `<select>`/drag).
- **Backlog GUT** (`BacklogGutPage.tsx:141-142`): a linha **não tem `onClick`** — só o botão
  "Planejar". Exibe rank/nº/status/prioridade/título/cliente/categoria/G-U-T-Score, mas **não**
  descrição, técnico ou datas — embora o objeto `detalhes` já venha carregado em memória
  (`supabase-hub-os-adapter.ts:88`).
- **Edição de OS**: `NovaOrdemServicoModal.tsx` só **cria** (props `aberto/onFechar/onCriada`, sem
  `id`, sem update). O `DetalheOs` (`OrdensServicoPage.tsx:599-724`) é read-only exceto status.
  Não existe caminho de edição dos campos da OS (título, descrição, técnico, prioridade, GUT, datas).

## Resumo
`NovaOrdemServicoModal` vira **criar OU editar** (recebe uma OS opcional; quando presente,
pré-preenche e salva via `editarOrdemServico`). Clicar no card do Kanban e na linha do Backlog abre
esse modal (ou um detalhe com botão "Editar"). O Backlog passa a exibir os campos ricos que já tem
em memória. A Lista reusa o mesmo caminho de edição.

## Critérios de aceite

### AC-1: Editar OS
- **Dado** um usuário com `pcm='escrita'`
- **Quando** abre uma OS existente e altera campos (título, descrição, categoria, prioridade, GUT,
  técnico, data prevista)
- **Então** salva via `editarOrdemServico` (novo caso de uso + `.update()` no adapter) e a lista
  reflete a mudança; mudança de status continua funcionando pelos caminhos atuais (select/drag)

### AC-2: Kanban card abre a OS
- **Dado** o Kanban de OS
- **Quando** o usuário clica no corpo do card (não no `<select>` de status nem durante drag)
- **Então** abre o detalhe/edição da OS. Com `pcm='leitura'`, abre read-only; com `escrita`, permite
  editar. Drag-and-drop (E01-S61) e `<select>` de status continuam funcionando (não conflitar o
  clique com o início do drag)

### AC-3: Backlog abre a OS
- **Dado** o Backlog GUT
- **Quando** o usuário clica na linha
- **Então** abre o mesmo detalhe/edição da OS; o botão "Planejar" continua funcionando isolado (o
  clique nele não abre o detalhe)

### AC-4: Backlog mais rico
- **Dado** um item do backlog
- **Quando** a fila renderiza
- **Então** exibe também descrição (ou trecho), técnico responsável e data prevista — usando os
  dados já carregados em `detalhes`/`OrdemServicoOperacional`, sem query nova

### AC-5: Sem duplicação
- **Dado** o painel `DetalhesTarefaAuvo`/`DetalheOs` já existente
- **Quando** o novo detalhe/edição é construído
- **Então** reusa/estende o que existe (não recria um segundo painel de detalhe de OS)

## Fora de escopo
> Vinculante.
- Renderizar questionários/fotos ricos do Auvo — E01-S70 (esta story só torna a OS abrível/editável).
- Novos campos de OS além dos já existentes no domínio `OrdemServicoOperacional`.

## Rastreabilidade
- Origem: teste Lucas 2026-07-14.
- Arquivos-âncora: `apps/web/src/features/pcm/components/NovaOrdemServicoModal.tsx` (criar→criar/editar),
  `apps/web/src/features/pcm/components/OsKanbanView.tsx`,
  `apps/web/src/features/pcm/pages/BacklogGutPage.tsx`,
  `apps/web/src/features/pcm/pages/OrdensServicoPage.tsx` (`DetalheOs`),
  `apps/web/src/features/pcm/application/abrir-ordem-servico.ts` (+ novo `editar-ordem-servico.ts`),
  `apps/web/src/features/pcm/infrastructure/supabase-hub-os-adapter.ts` (+ `.update()`).
- Dado rico já disponível: `mapearOrdem` carrega `auvo_detalhes→detalhes` em toda OS
  (`supabase-hub-os-adapter.ts:88`).
