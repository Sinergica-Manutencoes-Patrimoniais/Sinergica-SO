---
name: spec
description: Contrato — modal de Nova OS passa a listar os tipos de tarefa reais sincronizados do Auvo.
alwaysApply: true
---

# Spec — Tipos de tarefa reais no modal de Nova OS

> **Fonte da verdade.** Status: rascunho · Tier: Pequeno
> Feedback de teste manual do Lucas (2026-07-09, ponto 1): nem todas as categorias/tipos de tarefa do
> Auvo aparecem pra escolher ao abrir uma OS. Achado: o select "Tipo de tarefa Auvo" do modal usa 15
> strings hardcoded em `domain/abertura-os.ts`, desconectadas de `pcm.tipos_tarefa` — a tabela que já
> sincroniza a lista real do Auvo (`/tasktypes`, E01-S24) e tem CRUD completo em `TiposTarefaPage.tsx`.

## Resumo
O select "Tipo de tarefa" do modal de Nova OS passa a listar exatamente os tipos ativos de
`pcm.tipos_tarefa`, tornando-se obrigatório (mesmo tratamento do campo "Título *"). Os arrays/heurísticas
hardcoded (`TIPOS_AUVO`, `sugerirTipoAuvo`, `TIPO_POR_CATEGORIA`) são removidos.

## Critérios de aceite

### AC-1: Select mostra os tipos reais e ativos
- **Dado** N tipos de tarefa ativos (`ativo=true`, `deleted_at is null`) em `pcm.tipos_tarefa`
- **Quando** o modal de Nova OS abre
- **Então** o select "Tipo de tarefa" mostra exatamente esses N nomes, ordenados alfabeticamente

### AC-2: Campo obrigatório
- **Dado** o formulário de Nova OS
- **Quando** o usuário tenta submeter sem selecionar um tipo de tarefa
- **Então** o submit é bloqueado no client (mesma UX do campo Título)

### AC-3: Tipos inativos/deletados não aparecem
- **Dado** um tipo de tarefa com `ativo=false` ou `deleted_at` preenchido
- **Quando** o select carrega
- **Então** esse tipo não aparece como opção

### AC-4: Lista vazia não trava o formulário
- **Dado** nenhum tipo de tarefa ativo cadastrado (sync do Auvo nunca rodou)
- **Quando** o modal abre
- **Então** mostra estado vazio com link para a página "Tipos de Tarefa" em vez de travar o form

## Casos de borda e erros
- Falha ao carregar `tipos_tarefa` (RLS/rede): mesmo tratamento de erro já existente para clientes/técnicos
  (mensagem "Não foi possível carregar..." — não quebra o resto do modal).

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Persistir o tipo escolhido como coluna estruturada em `pcm.ordens_servico` e usá-lo na criação real da
  task no Auvo — isso é a **E01-S40** (arquitetural, migration própria).
- Mudar `CATEGORIAS_OS` (taxonomia PCM interna, não é a lista Auvo) — fica como está.
- CRUD de tipos de tarefa — já existe (`TiposTarefaPage`, E01-S24).

## Rastreabilidade
- Plano: `~/.claude/plans/foi-entregue-uma-serie-generic-owl.md`
- Relacionadas: E01-S24 (catálogo `tipos_tarefa`), E01-S40 (consumo estruturado + Auvo real).
- Arquivos-âncora: `apps/web/src/features/pcm/domain/abertura-os.ts`,
  `apps/web/src/features/pcm/components/NovaOrdemServicoModal.tsx`,
  `apps/web/src/features/pcm/application/ordem-servico-gateway.ts`,
  `apps/web/src/features/pcm/infrastructure/supabase-ordem-servico-adapter.ts`.
