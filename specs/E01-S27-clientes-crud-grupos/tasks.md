---
name: tasks
description: Decomposição e gates — Clientes CRUD (write-path novo sobre tabela existente) + Grupos de Clientes.
alwaysApply: false
---

# Tasks — Clientes CRUD + Grupos de Clientes

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Conferir `pcm.clientes` (migrations `0001`/`0022`): se `auvo_sync_status`/`auvo_sync_error`/`auvo_synced_at` já existem, pular; senão migration `00NN_E01-S27_clientes_sync_cols.sql` adicionando as que faltarem + trigger `create trigger ... execute function pcm.fn_auvo_enqueue('clientes')` em `pcm.clientes` | AC-1, AC-2, AC-3 | E01-S22 mergeada | `pnpm run lint:migrations`; pgTAP pendente (sem Docker) | done |
| 2  | Migration `00NN_E01-S27_cliente_grupos.sql`: tabela `pcm.cliente_grupos` (`id uuid`, `nome text not null`, `cliente_ids uuid[]` ou tabela de junção `pcm.cliente_grupo_membros` — decidido: `cliente_ids uuid[]` + `clientes_auvo_ids bigint[]`, porque o descriptor `toAuvo` não consulta joins e precisa montar `clientsId[]`), `auvo_id bigint unique`, colunas de sync + auditoria, RLS FORCE módulo `pcm`, trigger `fn_auvo_enqueue('cliente_grupos')` | AC-6, AC-7, AC-9 | 1 | `pnpm run lint:migrations`; pgTAP pendente (sem Docker) | done |
| 3  | Descriptor `registry/clientes.ts` (`auvoBasePath:'/customers'`, `webhookEntity:7`, `writeEnabled:false`, `toAuvo` mapeia os campos ricos já existentes em `pcm.clientes` do jeito que `pcm-auvo-customers-sync`/`pcm-auvo-customers-import` já fazem — reaproveitar a lógica de mapeamento existente, não reinventar) + `registry/cliente-grupos.ts` (`auvoBasePath:'/customergroups'`, `deleteStrategy:'hard-delete'`, `supportsUpdate:false` — os 2 campos já existem em `AuvoEntityDescriptor` desde `E01-S22`/`pcm-auvo-push` já os implementa —, `cronSchedule` diário — sem webhook, `/customergroups` não está entre as 6 entidades de webhook) | AC-1, AC-2, AC-3, AC-6, AC-7, AC-8 | 2 | testes Deno escritos; execução pendente (sem Deno CLI) | done |
| 4  | Estender `application/cliente-360-gateway.ts` + `infrastructure/supabase-cliente-360-adapter.ts` com `criarCliente`/`editarCliente`/`excluirCliente` (bloqueio de exclusão com OS aberta — regra de produto em `spec.md` → Casos de borda) | AC-1, AC-2, AC-3 | 1 | `pnpm run test`; `pnpm run typecheck` | done |
| 5  | `components/ClienteFormModal.tsx` (criar/editar) + botão de exclusão na `VisaoClientePage`/`ListaClientesPage` (gate `podeAcessar('pcm','escrita')`) | AC-9 | 4 | `pnpm run build`; manual pendente | done |
| 6  | Slice novo para Grupos de Clientes (domain/application/infrastructure/pages) seguindo o padrão de `E01-S24`, com aviso na UI de que renomear não propaga (AC-8) | AC-6, AC-7, AC-8, AC-9 | 2, 3 | `pnpm run test`; manual pendente | done |
| 7  | Wiring em `HomePage.tsx`: item "Grupos de Clientes" em CADASTROS (Clientes já está wired desde `E01-S12`) | AC-9 | 6 | `pnpm run build` | done |
| 8  | Refatorar o dispatcher de webhook (`E01-S23`) para usar este descriptor de Clientes como o primeiro caso real de `byWebhookEntity` — validação cruzada de que `E01-S23` está correto | AC-4, AC-5 | 3, E01-S23 mergeada | `registry/index.test.ts` atualizado; Deno pendente | done |
| 9  | pgTAP `supabase/tests/clientes_crud_rls.test.sql` (RLS de escrita em `pcm.clientes`, hoje só leitura testada) + `cliente_grupos_rls.test.sql` | AC-9 | 1, 2 | escritos; `supabase test db` pendente (sem Docker) | done |
| 10 | Rodar `pnpm run ci:local` | todos | 1–9 | `pnpm run ci:local` verde | done |
| 11 | Atualizar ROADMAP/STATE | — | 10 | revisão humana | done |

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
- [x] `pcm.cliente_grupos` usa arrays (`cliente_ids` + `clientes_auvo_ids`) em vez de tabela de
      junção: decisão local para manter `toAuvo()` puro e permitir `POST /customergroups` com
      `clientsId[]` sem consulta adicional do drain.

## Revisão adversarial (2026-07-07)
- **CORRIGIDO (crítico, perda de dado)** — `ListaClientesPage.tsx` inicializava o formulário de
  edição com `observacoes: ""` fixo (nunca `cliente?.observacoes`), e `listarClientes()` no adapter
  nem selecionava essa coluna. Qualquer edição feita a partir da lista de clientes apagava
  `observacoes` já cadastrada, mesmo que o operador só quisesse corrigir outro campo. Corrigido:
  `observacoes` adicionada a `ClienteResumo`, ao `select` de `listarClientes()` e ao valor inicial
  do form. Sem teste de página no projeto (padrão existente — só domain/application são testados).
- **CORRIGIDO** — `pcm.cliente_grupos.created_by` estava `not null` sem default (migration `0030`);
  mesmo gap de `E01-S24`/`E01-S25`/`E01-S26`, retrofitado para nullable.
- **CORRIGIDO** — `pcm-auvo-customers-sync` (fallback de `pcm-auvo-create-task`) e
  `pcm-auvo-customers-import` (bootstrap Auvo→PCM) escreviam em `pcm.clientes` sem passar pela RPC
  anti-loop (`fn_apply_auvo_sync`/`fn_upsert_auvo_sync`) — o trigger `trg_clientes_auvo_enqueue`
  (adicionado nesta story) enfileiraria eco na outbox a cada rodada do cron. Corrigido.
- **Follow-up não corrigido** — `excluirCliente` (checagem de OS aberta) e
  `resolverAuvoIds`/validação de sync completo do grupo (em `cliente-grupos`) são regras de negócio
  genuínas vivendo na camada de infraestrutura (`infrastructure/*-adapter.ts`) em vez de
  `application/`, furando a separação DDD do CLAUDE.md. Funcionam e são protegidas no servidor, mas
  ficam sem teste unitário.
- **Follow-up não corrigido** — `pcm.cliente_grupos.clientes_auvo_ids`/`cliente_ids` nunca são
  populados no sentido Auvo→PCM: `clienteGruposDescriptor.fromAuvo` só mapeia `nome`. Um grupo
  sincronizado do Auvo nunca reflete os clientes membros localmente.
- **Follow-up não corrigido** — `/customergroups` não tem `externalId` no POST; a mitigação
  "match-by-description" prometida no `design.md` de `E01-S22` não foi implementada (mesma lacuna
  de `E01-S24`/`E01-S25`).

## Checklist de Definition of Done
- [x] AC implementados em código; gates locais Node verdes
- [x] Regra de bloqueio de exclusão de cliente com OS aberta implementada
- [x] Nenhum `SPEC_DEVIATION` pendente
- [x] `docs/STATE.md`/`docs/epics/ROADMAP.md` atualizados
- [x] `pnpm run ci:local` verde
- [ ] Testes Deno e pgTAP executados em ambiente com Deno CLI/Docker
