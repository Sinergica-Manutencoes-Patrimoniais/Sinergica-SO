---
name: E01-S146-testes-e2e-ferramentas-clientes-equipamentos-tasks
description: Tasks da story E01-S146 (escopo corrigido — limpeza de poluição, não suíte nova)
---

# Tasks — E01-S146

## Achado real (mudou o escopo da story)
O pedido do Lucas ("Ainda existe ferramentas, clientes, equipamentos,[TESTE E2E]") é sobre dado
de teste **de volta** em produção, não falta de cobertura E2E. Investigação (via REST autenticado
contra produção, mesmo token da sessão real):
- **33 ferramentas**, **56 clientes**, **35 equipamentos** com prefixo `[TESTE E2E]` em produção.
- Causa raiz: **20 arquivos `e2e/*.spec.ts` criam dado `[TESTE E2E]` e nenhum limpa depois.** A
  limpeza de 2026-08-06 (`.claude/memory` / STATE.md) tratou o SINTOMA (apagou o lixo existente na
  época) mas não a causa — os specs continuaram rodando sem `afterEach`/cleanup, reacumulando.

## Feito

### 1. Limpeza dos 124 registros (autorizado pelo Lucas via AskUserQuestion)
- Checadas dependências reais (FK `NO ACTION` em `chamados`, `ordens_servico`, `tickets`,
  `sistemas`, `inspecoes`, etc.) — **zero dependência real** encontrada, mesmo achado do
  precedente de 2026-08-06.
- Deletado via `supabase db query --linked` (não há DELETE físico via RLS/PostgREST pra essas 3
  tabelas — só soft-delete; a limpeza direta via CLI bypassa RLS de propósito, mesmo padrão do
  precedente), ordem por FK: `equipamentos` → `ferramentas` → `clientes`.
- Confirmado 0 restante nas 3 tabelas depois.

### 2. Causa raiz — cleanup automático nos specs que mais poluíam
Helper novo `e2e/helpers/limpeza-e2e.ts::softDeletePorNome` — PATCH autenticado via REST (reusa o
token já logado da própria `page`, sem precisar de service_role) que seta `deleted_at`/`ativo:false`
na tabela/nome exatos. Reproduz o mesmo padrão do botão "Excluir" de Clientes (não há endpoint de
DELETE físico exposto por RLS pra `clientes`/`ferramentas`/`equipamentos`).

Wired em `afterEach` nos 4 specs que criam dado nessas 3 tabelas:
- `e2e/ferramentas.spec.ts` — soft-deleta a ferramenta criada.
- `e2e/clientes-marcacoes.spec.ts` — soft-deleta o cliente criado.
- `e2e/hierarquia-sistemas.spec.ts` — soft-deleta cliente + item (equipamento) criados.
- `e2e/board-ativos.spec.ts` — soft-deleta cliente + item (rastreando o nome renomeado no meio do
  fluxo, já que o teste edita o nome do item).

**Fora de escopo desta rodada**: áreas/locais/sistemas criados por `hierarquia-sistemas.spec.ts`/
`board-ativos.spec.ts` ficam órfãos (não aparecem nas 3 telas que o Lucas citou — Ferramentas,
Clientes, Equipamentos — então não geram o sintoma reportado). Cleanup completo da hierarquia fica
pra story própria se pedido. Os outros 16 arquivos com `[TESTE E2E]` (comercial, financeiro,
assessment, backlog-gut, etc.) também ficam de fora — pollution deles não foi citada pelo Lucas e
cada um exigiria entender um fluxo de UI diferente; sinalizado como débito conhecido.

### 3. Achados extras durante a correção (documentados, não corrigidos — fora de escopo)
- **`ferramentas.spec.ts` estava com o teste quebrado contra a UI atual**: o campo "Quantidade
  total" não existe mais no formulário de criação (mudou desde que o spec foi escrito). Reescrito
  pra bater com o fluxo real (código de patrimônio na criação, 1ª unidade automática).
- **Bug real achado nesse processo**: `criarFerramenta` grava `quantidade_total: 0` e
  `gerarUnidadesFerramenta` (chamada em seguida pra criar a 1ª unidade) nunca incrementa esse
  campo — toda ferramenta nova mostra "1/0 unid." em vez de "1/1". Não é o que o Lucas pediu nesta
  story; sinalizado pra story própria.

## Validação
- `ferramentas.spec.ts`, `clientes-marcacoes.spec.ts`, `hierarquia-sistemas.spec.ts`,
  `board-ativos.spec.ts` — todos verdes contra produção real.
- Confirmado por query direta: 0 registros `[TESTE E2E]` não-deletados em ferramentas/clientes/
  equipamentos após rodar os 4 specs.
- `biome check` verde nos 5 arquivos tocados.
