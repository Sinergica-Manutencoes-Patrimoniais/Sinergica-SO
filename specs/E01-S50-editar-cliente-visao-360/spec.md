---
name: spec
description: Contrato — editar cadastro do cliente diretamente na aba 360.
alwaysApply: true
---

# Spec — Editar cliente diretamente na aba 360

> **Fonte da verdade.** Status: rascunho · Tier: Pequeno
> Feedback de teste manual do Lucas (2026-07-09, ponto 7): "Não é possível editar as informações do
> cliente pelo PCM, seria muito melhor." Achado: já existe CRUD local completo em `ListaClientesPage.tsx`
> — só não estava exposto na 360, que só linkava "Editar no Auvo".

## Resumo
`ClienteFormModal` (extraído de `ListaClientesPage.tsx` pra componente compartilhado) fica disponível
também na Visão 360, via botão "Editar cadastro (local)" no painel de cadastro. O banner é reescrito pra
não prometer mais do que o sistema faz hoje (`writeEnabled` de clientes continua `false` após a E01-S47).

## Critérios de aceite

### AC-1: Botão de edição na 360
- **Dado** a Visão 360 de um cliente, usuário com `pcm:escrita`
- **Quando** a tela carrega
- **Então** um botão "Editar cadastro (local)" abre o mesmo modal/validação já usado em Lista de
  Clientes

### AC-2: Salvar atualiza a 360 sem reload de página
- **Dado** o modal aberto com alterações
- **Quando** o usuário salva
- **Então** os campos exibidos na 360 refletem a mudança (recarrega a visão via `obterVisaoCliente`)

### AC-3: Banner reflete o comportamento real
- **Dado** o painel de cadastro
- **Quando** exibido
- **Então** o texto não afirma "alterações devem nascer no Auvo" — explica que a edição é local e a
  sincronização automática ainda não está habilitada

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Habilitar `writeEnabled` de clientes — decisão da E01-S47 (mantido `false`).
- Exclusão de cliente pela 360 — só edição.

## Rastreabilidade
- Plano: `~/.claude/plans/foi-entregue-uma-serie-generic-owl.md`
- Depende de: E01-S47 (estado real de `writeEnabled`), E01-S46 (padrão de banner honesto).
- Arquivos-âncora: novo `apps/web/src/features/pcm/components/ClienteFormModal.tsx` (extraído de
  `ListaClientesPage.tsx`), `apps/web/src/features/pcm/pages/VisaoClientePage.tsx`.
