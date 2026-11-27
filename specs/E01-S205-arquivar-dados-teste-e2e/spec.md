---
name: spec
description: Arquivar (não apagar) os dados [TESTE E2E] de produção, reversível, sem tocar o Auvo.
alwaysApply: true
---

# E01-S205 — Arquivar os dados `[TESTE E2E]` de produção

Origem: item 5 da homologação do caderno 2026-11 ("encabeçam todos os seletores"). Dono decidiu
**arquivar, não apagar**. Os specs Playwright gravam em produção (SEC-006) e só 4 se limpam.

## Critérios de aceite
- **AC-1 Seleção:** só linhas vivas de `clientes` (nome com prefixo `[TESTE E2E] `, `auvo_id` nulo,
  fora da allowlist) e seus filhos (áreas, locais, sistemas, equipamentos), mais equipamentos e
  ferramentas com o prefixo e `auvo_id` nulo.
- **AC-2 Allowlist por id:** a massa ativa do caderno (Cockpit A e Cliente S90) e tudo que é filho
  dela fica intacta; cliente sem prefixo (Escritório) nunca entra.
- **AC-3 Operação:** `deleted_at = now()` + `ativo = false` (mecanismo existente), sem renomear,
  sem alterar `auvo_sync_status`, **sem enfileirar nada para o Auvo** (GUC `app.auvo_sync_write`).
- **AC-4 Idempotente:** 2ª execução toca 0 linhas.
- **AC-5 Reversível:** `pcm.restaurar_dados_teste_e2e([lote])` devolve `deleted_at`/`ativo` do log,
  só onde o `deleted_at` ainda é o carimbo do arquivamento.
- **AC-6 Dry-run por padrão** e execução só por `service_role`/SQL editor; `authenticated` não executa
  nem escreve; log/allowlist com RLS FORCE (leitura só superadmin).
- **AC-7 Seletores:** nenhum código novo — já filtram `deleted_at IS NULL`.

## Fora de escopo (vinculante)
Chamados/OS/inspeções das contas arquivadas, comercial, financeiro, Atendimento, categorias,
prevenção de reincidência nos ~16 specs sem limpeza (fase 2 / story própria). A migration **não
executa** o arquivamento: só cria o instrumento; executar é passo à parte após aprovar `inventario.sql`.

## Rastreabilidade
`supabase/migrations/1911_E01-S205_arquivar_dados_teste_e2e.sql` ·
`supabase/tests/e2e_arquivamento_dados_teste.test.sql` · `inventario.sql`.
