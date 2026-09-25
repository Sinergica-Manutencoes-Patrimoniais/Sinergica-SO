---
name: E01-S148-editar-cliente-status
description: Permitir editar status/campos de cliente no PCM (ativo, cliente, tipo, etc)
alwaysApply: true
---

# E01-S148 — Editar cliente (status, ativo) no PCM

## Contexto
Hoje `pcm.clientes` é read-only no PCM (só Comercial grava).
Lucas: precisa **editar status** de cliente no detalhe (cliente ativo → inativo, tipo, etc).
Comercial é dono; PCM é consumidor que **precisa ter escrita limitada**.

## Requisitos

### AC-1: Editar campos no detalhe do cliente
- Nome, CNPJ, telefone, endereco, **status** (`ativo`, `tipo`, `status_comercial`)
- Modal/inline de edição no detalhe (Visão 360 do cliente)

### AC-2: Guardar com RLS
- Apenas usuários com `pcm:escrita` podem editar
- Comercial pode editar sempre (é dono)
- PCM de outros módulos não conseguem (RLS FORCE)

### AC-3: Validação
- CNPJ (se preenchido): formato válido
- Status: enum válido (`ativo`, `inativo`)

### AC-4: Histórico
- Não exigido nesta story (débito técnico — `audit.*` já registra em produção)

## Fora de escopo
- Deletar cliente
- Alterar permissões (criação de nova linha em papéis)

## Tier
Pequeno (edição simples, RLS já existe).

---

## Tarefas

1. **RPC:** criar ou reusar `fn_atualizar_cliente` (guarda: `pcm:escrita` OR `comercial:escrita` OR superadmin)
2. **Adapter:** `supabase-clientes-adapter.ts` ganha `atualizarCliente`
3. **UI:** modal de edição em `VisaoClientePcm` (ou novo componente)
4. **Validation:** Zod schema pra campos editáveis
5. **Testes:** unit (schema) + pgTAP (RLS escrita) + Playwright (modal)

---

## Validação
- `ci:local` verde
- Edita cliente, salva em DB, volta do servidor
- RLS: PCM sem `escrita` recusa, Comercial consegue
