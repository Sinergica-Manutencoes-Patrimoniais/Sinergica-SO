---
name: E01-S147-filtrar-clientes-excluir-leads
description: Filtrar base de clientes no PCM — exibir só clientes ativos, não leads
alwaysApply: true
---

# E01-S147 — Filtrar clientes (excluir leads) na view PCM

## Contexto
Base de clientes é compartilhada (Shared Kernel) — PCM, Comercial, Atendimento consomem.
Hoje exibe **tudo**: clientes, leads, prospectos.
Lucas: PCM só vê **clientes ativos** (operação em andamento). Leads/prospectos = comercial.

## Requisitos

### AC-1: Filtro automático
- Query `listarClientes` (PCM) passa `where status NOT IN ('lead','prospecto')` + `ativo = true`
- Não é opção na UI — é padrão automático

### AC-2: Visão 360 do cliente
- Continua só com quem tem OS aberta (já existente)
- Nenhuma mudança comportamento — só filtro da lista

### AC-3: Configuração de cliente
- Continua bloqueada pro PCM (gravação em `pcm.clientes` proibida)
- Redireciona pra "Configure no Comercial" se tentar

## Fora de escopo
- Editar dados de cliente (AC-2 de S148)
- Importação de leads do Auvo (Comercial/E03)

## Tier
Trivial (filtro de query).

---

## Tarefas

1. **Adapter:** `supabase-clientes-adapter.ts` filtra `status != 'lead' AND status != 'prospecto' AND ativo = true`
2. **Testes:** unit confirma filtro
3. **Playwright:** lista só clientes de verdade (sem leads)

---

## Validação
- `ci:local` verde
- Lista PCM não mostra leads
