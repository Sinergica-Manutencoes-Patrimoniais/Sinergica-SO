---
name: E01-S152-fotos-pipeline-inspecao-os
description: Carrega fotos (e local/descrição já disponíveis) por toda a cadeia Inspeção → Backlog → Chamado → OS
alwaysApply: true
---

# E01-S152 — Fotos e informação seguem a cadeia Inspeção → Backlog → Chamado → OS

## Contexto
Lucas (2026-08-16): "Quando sai da inspeção para o backlog deve levar o que tem de informação,
inclusive as imagens — a mesma coisa do backlog para o chamado e do chamado para OS."

Hoje `InspecaoItem.fotoUrls` (E01-S97, galeria de fotos por item) já existe e é populado no import
(XLS/PDF/Auvo), mas se perde nas 3 transições da cadeia — nenhuma delas tem coluna de foto:
- `derivarItemParaOsOuBacklog`/`confirmarGerarBacklog` (item → OS de backlog): não passam
  `fotoUrls` pra `CriarOrdemServicoInput` — campo nem existe no tipo.
- `confirmarChamado` (OS de backlog → Chamado, E01-S151): só lê `client_id,titulo` da OS.
  `derivarItemParaChamado` (item → Chamado direto, `handleAbrirChamado`): só passa `titulo`, nem
  `local` (que `ChamadoFormData.local` já suporta) nem fotos.
- `gerarOsDoChamado` (Chamado → OS): já carrega `titulo`/`descricao` do Chamado pro comando da OS,
  mas não tem fotos pra carregar (Chamado nunca teve coluna de foto).

Causa raiz: `pcm.ordens_servico` e `pcm.chamados` nunca ganharam coluna de foto — só
`pcm.inspecao_itens` tem (`foto_urls jsonb`, migration `0150`).

## Requisitos

### AC-1: `pcm.ordens_servico` e `pcm.chamados` ganham `foto_urls`
Coluna `foto_urls jsonb not null default '[]'::jsonb` nas duas tabelas — mesmo formato de
`pcm.inspecao_itens.foto_urls`.

### AC-2: Inspeção → Backlog carrega fotos
`derivarItemParaOsOuBacklog`/`confirmarGerarBacklog` (revisão em lote, E01-S143) e o novo caminho
de import direto (checkbox "enviar pro backlog", E01-S105) passam `item.fotoUrls` pro
`CriarOrdemServicoInput.fotoUrls` (novo campo opcional). Persistido em `ordens_servico.foto_urls`.

### AC-3: Inspeção → Chamado direto carrega fotos e local
`derivarItemParaChamado` (`handleAbrirChamado`) passa `local: item.localizacao` e
`fotoUrls: item.fotoUrls` pro `ChamadoFormData` (`local` já existia no tipo, só não era usado aqui;
`fotoUrls` é novo). Persistido em `chamados.foto_urls`.

### AC-4: Backlog → Chamado carrega fotos (E01-S151 `confirmarChamado`)
`confirmarChamado` passa a ler `descricao,local_descricao,foto_urls` da OS (além de
`client_id,titulo` que já lia) e repassa pro Chamado criado.

### AC-5: Chamado → OS carrega fotos (`gerarOsDoChamado`)
Comando de criação da OS ganha `fotoUrls: chamado.fotoUrls`, ao lado de `titulo`/`descricao` que já
carregava.

### AC-6: Fotos visíveis nos detalhes
- Painel do Chamado (`ChamadoPainel.tsx`, `DetalheChamado`): bloco "Fotos" abaixo de "Local",
  mesmo padrão visual de miniaturas já usado em `InspecoesPage.tsx` (thumbnail 64×64, abre a
  original em nova aba). Omitido quando vazio.
- Painel de detalhe da OS (`OrdensServicoPage.tsx`): mesmo bloco, junto da grid de `Info`.

## Fora de escopo
- Upload de fotos direto no Chamado/OS (captura nova) — só carregar o que já veio de um item de
  inspeção de origem.
- Compor um novo texto de `descricao` a partir de `recomendacao`/`anomalia`/`estadoConservacao` do
  item — só evita perder o que já está em campos existentes (`local`/fotos); texto livre já
  carregado (`titulo`/`descricao`/`observacao`) não muda de fonte.
- Mídias que não são foto (`InspecaoItem.midias`, ex. vídeo/PDF anexado) — só `fotoUrls`.

## Tier
Pequeno (2 colunas `jsonb` aditivas, sem dado existente pra migrar — `default '[]'`; mudanças de
aplicação contidas nos gateways/adapters já existentes da cadeia OS/Chamado). Não precisa de ADR
novo — extensão aditiva de ADR-0014/E01-S151, não reverte decisão nenhuma.

---

## Validação
- `ci:local` verde (typecheck + biome + vitest).
- Smoke local: item de inspeção com foto → "Gerar backlog" (revisão em lote) → OS de backlog
  mostra a foto no painel. "Confirmar chamado" nela → Chamado mostra a mesma foto. Item de
  inspeção com foto → "Abrir chamado" direto → Chamado mostra a foto e o local.
