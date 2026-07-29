---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Todas as listagens/seletores de cliente mostram só Ativos

> **Fonte da verdade.** Status: rascunho
> Origem: feedback do Lucas testando localmente (2026-07-29). Item 5.

## Resumo
Auditar todos os pontos do PCM que listam clientes (seletores em formulários e a lista principal) e
garantir que só mostram clientes **Ativos** por padrão — hoje é misto: alguns pontos já filtram
(`carregarDadosAberturaOs` em `supabase-ordem-servico-adapter.ts`), outros não.

## Critérios de aceite

### AC-1: Seletores de cliente em formulários mostram só Ativos
- **Dado** qualquer formulário com seletor de cliente (Novo Chamado, Nova OS, Agenda do Técnico,
  Alocar Ferramenta, Novo Responsável, etc.)
- **Quando** o seletor carrega
- **Então** só clientes com `ativo = true` aparecem.

### AC-2: Lista principal de clientes (`ListaClientesPage`) tem "Ativo" como filtro padrão
- **Dado** a tela de listagem de clientes
- **Quando** carrega pela primeira vez (sem filtro manual do operador)
- **Então** o filtro de status inicia em "Ativo" (não "Todos"); o operador ainda pode trocar pra
  "Todos"/"Inativo" manualmente — a opção continua existindo, só o padrão muda.

### AC-3: Cliente inativo continua acessível pela Visão 360 direta
- **Dado** um cliente inativo já vinculado a um chamado/OS existente
- **Quando** o operador abre a Visão 360 dele (não pela lista, por um link direto)
- **Então** continua acessível normalmente — o filtro é só na descoberta/seleção, não bloqueia
  acesso a dado que já existe.

## Casos de borda e erros
- Cliente fica inativo com Chamados/OS em aberto vinculados a ele → não é problema desta story
  (dado histórico continua visível via Visão 360, AC-3); só novos formulários não o oferecem mais
  como opção de seleção.

## Fora de escopo
- Mudar o que significa "ativo" no cadastro do cliente (já existe, `pcm.clientes.ativo`).
- Soft-delete ou arquivamento de cliente — fora do escopo, é só filtro de exibição.

## Rastreabilidade
- Código a auditar: `carregarDadosAberturaOs` (já filtra), `AgendaTecnicoPage`
  (`supabase-agenda-tecnico-adapter.ts.listarClientes`, já filtra), `ListaClientesPage.tsx`
  (filtro existe, padrão precisa mudar), e qualquer outro seletor de cliente não auditado ainda.
- ADRs relacionados: —
