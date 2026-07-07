---
name: tasks
description: Decomposição e gates — Equipamentos CRUD no PCM, sincronizado com Auvo /equipments.
alwaysApply: false
---

# Tasks — Equipamentos

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Registrar decisão durável em ADR nova: PCM origina cadastro/comandos de Equipamentos e movimenta o Auvo; Auvo segue autoridade operacional/de campo | — | decisão PO 2026-07-07 | revisão humana | done |
| 2  | Migration `00NN_E01-S29_promove_equipamentos.sql`: promover `pcm.equipamentos_cache` → `pcm.equipamentos` (ou criar tabela nova + migrar/deprecar a cache, escolher o caminho mais compatível com E01-S11/E01-S16), adicionar colunas cadastrais necessárias (`identificador`, `categoria`, `cliente`, garantia/ficha mínima se já existir no payload Auvo), colunas de sync, trigger `fn_auvo_enqueue('equipamentos')`, e substituir policies deny de `0012` por policies de escrita por módulo `pcm` com comentário apontando para `ADR-0006` | AC-1, AC-2, AC-3, AC-7 | E01-S22 mergeada | `supabase test db` | done |
| 3  | Descriptor `registry/equipamentos.ts` (`auvoBasePath:'/equipments'`, `webhookEntity:27`, `writeEnabled:false`, `deleteStrategy:'soft-patch'`, `toAuvo` mapeia `externalId` e campos cadastrais reais; confirmar campo de desativação antes de codar se não for `active`) | AC-1, AC-2, AC-3, AC-4 | 2 | teste Deno do descriptor | done |
| 4  | Estender/criar `application/equipamentos-gateway.ts` + `infrastructure/supabase-equipamentos-adapter.ts` com `listar`/`criar`/`editar`/`desativar`, mantendo `pcm.os_equipamentos_auvo` como vínculo separado | AC-1, AC-2, AC-3, AC-5, AC-6 | 2 | `vitest` | done |
| 5  | `pages/EquipamentosPage.tsx` (lista + criar + editar + desativar, status de sync, confirmação ao desativar equipamento com OS aberta, gate `podeAcessar('pcm','escrita')`) | AC-6 | 4 | teste manual em browser | done |
| 6  | Wiring em `HomePage.tsx`: item "Equipamentos" em CADASTROS/PCM sem quebrar a Visão 360 que já lê equipamentos do cliente | AC-6 | 5 | `pnpm run build` | done |
| 7  | Refatorar consumidor de `pcm.equipamentos_cache` (Visão 360/E01-S16) para ler a fonte promovida sem duplicar consulta nem perder compatibilidade com `auvo_customer_id` | AC-5 | 2, 4 | `vitest` + `pnpm run build` | done |
| 8  | pgTAP `supabase/tests/equipamentos_rls.test.sql`: confirma que RLS agora PERMITE escrita por módulo (inversão documentada e testada, não assumida) | AC-7 | 2 | `supabase test db` | done |
| 9  | Rodar `pnpm run ci:local` | todos | 2–8 | `pnpm run ci:local` | done |
| 10 | Atualizar ROADMAP/STATE | — | 9 | revisão humana | done |

## Plano de teste
- Unidade: adapter/use cases de Equipamentos, descriptor `/equipments`, compatibilidade da Visão
  360/E01-S16 com a tabela promovida.
- pgTAP: RLS agora permite escrita por módulo, com comentário explícito da inversão de contrato.
- Manual: criar/editar/desativar equipamento, conferir status de sync e vínculo OS ↔ equipamento.
- Aceite: os 7 AC de `spec.md`.

## Divergências (SPEC_DEVIATION)
- [x] Decisão PO 2026-07-07 registrada: S29 não fica bloqueada. Auvo segue autoridade
      operacional, mas o registro/comando de Equipamentos passa pelo PCM e movimenta o Auvo,
      seguindo o padrão de OS formalizado em `ADR-0001` e estendido por `ADR-0006`.
- [x] Caminho técnico escolhido para preservar compatibilidade com E01-S11/E01-S16:
      `0032_E01-S29_equipamentos.sql` cria `pcm.equipamentos`, migra os dados existentes de
      `pcm.equipamentos_cache` e mantém a cache legada sem removê-la. Consumidores PCM foram
      movidos para a fonte promovida.
- [x] O teste manual em browser não criou dado real: a tela, adapter, domínio e build foram
      validados localmente. Qualquer UAT com usuário real deve criar registro descartável e
      reverter/excluir ao fim, conforme orientação do Lucas.

## Revisão adversarial (2026-07-07)
- **CORRIGIDO** — mesmo achado de `E01-S28`: `pcm-auvo-equipment-sync` (legada de `E01-S11`, cron
  diário) gravava direto em `pcm.equipamentos` sem o anti-loop, e esta story anexou
  `trg_equipamentos_auvo_enqueue`. Corrigido: upsert via `fn_upsert_auvo_sync`, desativação via
  `fn_apply_auvo_sync` por linha, preservando `client_id` (resolvido pelo lookup de
  `pcm.clientes.auvo_id` que a função já fazia).
- **Follow-up não corrigido** — `EquipamentosPage.tsx` chama `supabaseEquipamentosAdapter`
  (infrastructure) direto para checar OS aberta antes de confirmar desativação, pulando a camada
  `application/` — única violação de camadas DDD encontrada nas 9 entidades desta leva.
- **Follow-up não corrigido** — `equipamentosDescriptor.fromAuvo` (usado pelo webhook/pull
  genéricos) nunca mapeia `client_id` — só `auvo_customer_id`. `client_id` só fica correto para os
  registros migrados no backfill inicial; todo equipamento sincronizado depois via webhook/pull
  fica com `client_id NULL` (joins por cliente ignoram o registro). Resolver exigiria um hook de
  enriquecimento com acesso a `db` no contrato do registry (`fromAuvo` hoje é função pura sem I/O) —
  não é um fix pontual, é uma decisão de design a levar para o `@architect`.

## Checklist de Definition of Done
- [x] AC-1 a AC-7 verdes pelo gate executável local disponível
- [x] `ADR-0006` referenciada na migration de promoção
- [x] Nenhum consumidor antigo de `pcm.equipamentos_cache` quebrado
- [x] `docs/STATE.md`/`docs/epics/ROADMAP.md` atualizados
- [x] `pnpm run ci:local` verde
