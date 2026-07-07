---
name: tasks
description: Decomposição e gates — Clientes CRUD (write-path novo sobre tabela existente) + Grupos de Clientes.
alwaysApply: false
---

# Tasks — Clientes CRUD + Grupos de Clientes

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Conferir `pcm.clientes` (migrations `0001`/`0022`): se `auvo_sync_status`/`auvo_sync_error`/`auvo_synced_at` já existem, pular; senão migration `00NN_E01-S27_clientes_sync_cols.sql` adicionando as que faltarem + trigger `create trigger ... execute function pcm.fn_auvo_enqueue('clientes')` em `pcm.clientes` | AC-1, AC-2, AC-3 | E01-S22 mergeada | `supabase test db` | todo |
| 2  | Migration `00NN_E01-S27_cliente_grupos.sql`: tabela `pcm.cliente_grupos` (`id uuid`, `nome text not null`, `cliente_ids uuid[]` ou tabela de junção `pcm.cliente_grupo_membros` — decidir na implementação; tabela de junção é mais correto relacionalmente, array é mais simples de sincronizar com `clientsId[]` do Auvo, escolher e documentar), `auvo_id bigint unique`, colunas de sync + auditoria, RLS FORCE módulo `pcm`, trigger `fn_auvo_enqueue('cliente_grupos')` | AC-6, AC-7, AC-9 | 1 | `supabase test db` | todo |
| 3  | Descriptor `registry/clientes.ts` (`auvoBasePath:'/customers'`, `webhookEntity:7`, `writeEnabled:false`, `toAuvo` mapeia os campos ricos já existentes em `pcm.clientes` do jeito que `pcm-auvo-customers-sync`/`pcm-auvo-customers-import` já fazem — reaproveitar a lógica de mapeamento existente, não reinventar) + `registry/cliente-grupos.ts` (`auvoBasePath:'/customergroups'`, `deleteStrategy:'hard-delete'`, `supportsUpdate:false` — os 2 campos já existem em `AuvoEntityDescriptor` desde `E01-S22`/`pcm-auvo-push` já os implementa —, `cronSchedule` diário — sem webhook, `/customergroups` não está entre as 6 entidades de webhook) | AC-1, AC-2, AC-3, AC-6, AC-7, AC-8 | 2 | teste Deno dos 2 descriptors | todo |
| 4  | Estender `application/cliente-360-gateway.ts` + `infrastructure/supabase-cliente-360-adapter.ts` com `criarCliente`/`editarCliente`/`excluirCliente` (bloqueio de exclusão com OS aberta — regra de produto em `spec.md` → Casos de borda) | AC-1, AC-2, AC-3 | 1 | `vitest` | todo |
| 5  | `components/ClienteFormModal.tsx` (criar/editar) + botão de exclusão na `VisaoClientePage`/`ListaClientesPage` (gate `podeAcessar('pcm','escrita')`) | AC-9 | 4 | teste manual em browser | todo |
| 6  | Slice novo para Grupos de Clientes (domain/application/infrastructure/pages) seguindo o padrão de `E01-S24`, com aviso na UI de que renomear não propaga (AC-8) | AC-6, AC-7, AC-8, AC-9 | 2, 3 | `vitest` + manual | todo |
| 7  | Wiring em `HomePage.tsx`: item "Grupos de Clientes" em CADASTROS (Clientes já está wired desde `E01-S12`) | AC-9 | 6 | `pnpm run build` | todo |
| 8  | Refatorar o dispatcher de webhook (`E01-S23`) para usar este descriptor de Clientes como o primeiro caso real de `byWebhookEntity` — validação cruzada de que `E01-S23` está correto | AC-4, AC-5 | 3, E01-S23 mergeada | teste de regressão do dispatcher | todo |
| 9  | pgTAP `supabase/tests/clientes_crud_rls.test.sql` (RLS de escrita em `pcm.clientes`, hoje só leitura testada) + `cliente_grupos_rls.test.sql` | AC-9 | 1, 2 | `supabase test db` | todo |
| 10 | Rodar `pnpm run ci:local` | todos | 1–9 | `pnpm run ci:local` | todo |
| 11 | Atualizar ROADMAP/STATE | — | 10 | revisão humana | todo |

## Plano de teste
- Unidade: adapter de clientes (novos métodos), domínio/use cases de Grupos de Clientes,
  descriptors×2, `supportsUpdate` no `pcm-auvo-push`.
- pgTAP: RLS de escrita em `pcm.clientes` (hoje só há teste de leitura da Visão 360), RLS de
  `pcm.cliente_grupos`.
- Manual: criar/editar/excluir cliente na tela; criar/excluir Grupo de Clientes; confirmar aviso
  de "não propaga" ao renomear grupo.
- Aceite: os 9 AC de `spec.md`.

## Divergências (SPEC_DEVIATION)
- [x] `/customergroups` não tem `PATCH` documentado — resolvido em `E01-S22` (campo aditivo
      `supportsUpdate`, já implementado e testado em `pcm-auvo-push` antes desta story existir).

## Checklist de Definition of Done
- [ ] Todos os AC (AC-1 a AC-9) verdes pelo gate executável
- [ ] Regra de bloqueio de exclusão de cliente com OS aberta implementada e testada
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] `docs/STATE.md`/`docs/epics/ROADMAP.md` atualizados
- [ ] `pnpm run ci:local` verde
