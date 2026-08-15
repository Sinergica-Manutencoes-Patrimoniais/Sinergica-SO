---
name: E01-S146-testes-e2e-ferramentas-clientes-equipamentos
description: Suite E2E (Playwright) para CRUD ferramentas, clientes, equipamentos (clean fixtures)
alwaysApply: true
---

# E01-S146 — Testes E2E — Ferramentas, Clientes, Equipamentos

> **Escopo corrigido (2026-08-12).** O pedido original do Lucas ("Ainda existe ferramentas,
> clientes, equipamentos,[TESTE E2E]") **não era falta de teste — era poluição de dado real em
> produção**, de volta desde a limpeza de 2026-08-06. Achado: 20 specs `e2e/*.spec.ts` criam dado
> `[TESTE E2E]` e **nenhum limpa depois** (a limpeza de 2026-08-06 tratou o sintoma, não a causa).
> Confirmado ao vivo: 124 registros acumulados (33 ferramentas, 56 clientes, 35 equipamentos).
> Ver `tasks.md` para o que foi feito de verdade — os AC abaixo (suíte E2E nova do zero) **não
> foram implementados**, porque já existem specs cobrindo CRUD de ferramentas/clientes/equipamentos
> (`ferramentas.spec.ts`, `clientes-marcacoes.spec.ts`, `hierarquia-sistemas.spec.ts`,
> `board-ativos.spec.ts`) — faltava só limpeza, não cobertura.

## Contexto (original, mantido para histórico)
Telas do PCM (cadastros de Ferramentas, Clientes, Equipamentos) têm testes unit, mas **sem E2E real**.
Lucas quer validar CRUD end-to-end + UI antes de novos refactores visuais (E00-S14..S23).

Dependência: limpeza do `[TESTE E2E]` já feita (2026-08-06), fixtures isoladas.

## Requisitos

### AC-1: Fixture isolada
- Conta de teste dedicada (sem reusar ambiente compartilhado)
- Dados de teste com prefixo `[E01-S146]` (rastreável, fácil limpar)

### AC-2: CRUD Ferramentas
- Criar ferramenta (nome, tipo, quantidade)
- Ler lista + detalhe
- Editar nome/quantidade
- Deletar (soft, com confirmação)

### AC-3: CRUD Clientes
- Criar cliente (nome, CNPJ, telefone)
- Buscar/filtrar por nome ou CNPJ
- Editar status (ativo/inativo)
- Listar com paginação

### AC-4: CRUD Equipamentos
- Criar equipamento (cliente, tipo, série, garantia)
- Vincular a cliente (FK)
- Editar tipo/garantia
- Deletar com cascata (OS que referenciava)

### AC-5: Sem poluição pós-teste
- Cleanup automático (apagar `[E01-S146]` ao finalizar)
- Não deixar lixo em produção

## Fora de escopo
- Performance/carga
- Validação de erro detalhada por campo (reusa AC de unit)

## Tier
Trivial (só testes, zero código de feature).

---

## Tarefas

1. **Playwright:** `ferramentas.spec.ts` (3 scenarios: criar, editar, deletar)
2. **Playwright:** `clientes.spec.ts` (4 scenarios: CRUD + busca)
3. **Playwright:** `equipamentos.spec.ts` (4 scenarios: criar, vincular, editar, deletar)
4. **Fixture:** login automático + criar Conta `[E01-S146]`
5. **Cleanup:** `afterAll` deleta todos com prefixo
6. **CI:** rodar 3 specs na matriz `pnpm run e2e`

---

## Validação
- `pnpm run e2e ferramentas equipamentos clientes` verde (3/3 specs)
- Sem sobra de dados em produção após rodada
