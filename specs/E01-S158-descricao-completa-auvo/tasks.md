---
name: tasks-E01-S158
description: Tasks da E01-S158 — fn_montar_descricao_auvo, coluna auvo_descricao por trigger, propagação de rename, descriptors, exibição.
alwaysApply: false
---

# Tasks — E01-S158 Descrição completa no Auvo

> Commits: `feat(E01-S158): ...`. Leia `design.md` → "Regra de ouro" e "Ordem dos triggers".

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | **Migration** `NNNN_E01-S158_descricao_completa_auvo.sql`: colunas `auvo_descricao`; função `pcm.fn_montar_descricao_auvo` (AC-1, `array_remove(array[...], null)` + `array_to_string(..., ' - ')`); funções/triggers `trg_equipamentos_texto_auvo` e `trg_sistemas_texto_auvo` (AC-2); `create or replace` de `pcm.fn_areas_propagar_localizacao` e `pcm.fn_locais_propagar_localizacao`, acrescentando `auvo_descricao = pcm.fn_montar_descricao_auvo(...)` nos mesmos UPDATEs que já recalculam `auvo_localizacao` (parta da versão que a E01-S155 deixou; **releia a migration da S155** antes). Sem UPDATE fora de trigger. | AC-1, AC-2, AC-3 | — | `supabase db lint` | pronto local; aplicar no lote |
| 2 | **pgTAP** `supabase/tests/pcm_descricao_auvo.test.sql`: 4 linhas da tabela do AC-1 via função; insert de componente preenche a coluna; update de `nome` recalcula; rename de Área e de Local propaga para componente e sistema; rename de cliente **não** muda. | AC-1, AC-2, AC-3 | 1 | `supabase test db` | escrito; aguarda CI db-tests |
| 3 | **Descriptors** `registry/equipamentos.ts` e `registry/sistemas.ts`: `auvo_descricao?: string \| null` nos Row e `description` conforme AC-4. Testes Deno (`equipamentos.test.ts`, `sistemas.test.ts`): com e sem `auvo_descricao`. Depois do merge: redeploy de `pcm-auvo-push`, `pcm-auvo-pull`, `pcm-auvo-sync-all`, `pcm-auvo-webhook`, `pcm-auvo-webhooks-register` + smoke 401. | AC-4 | 1 | `deno test supabase/functions/_shared/auvo/registry/` (CI) | pronto local; redeploy no lote |
| 4 | **Web**: `EquipamentoItem` e `Sistema` ganham `auvoDescricao: string \| null`; adapters leem a coluna (`COLS`); `DrawerDetalheAtivo.tsx` mostra "Nome completo (Auvo)" (AC-5). A lista de Componentes da 360 (E01-S159) mostra o mesmo campo; se a S159 já estiver mergeada, adicione lá também. | AC-5 | 1 | typecheck + `pnpm run ci:local` | pronto local; validação final no lote |

## Plano de teste
- Banco: pgTAP (task 2). Deno: descriptors (task 3).
- Aceite: com um componente de teste, conferir no Auvo a descrição completa depois do drain
  (mesma evidência da verificação AC-10 da S157, pode ser feita junto).

## Divergências (SPEC_DEVIATION)
- [ ] (vazio)

## Checklist de Definition of Done
- [ ] AC-1..AC-5 verdes · CI `db-tests` e Deno verdes
- [ ] Migration em produção · outbox sem enfileiramento em massa
- [ ] Edge Functions redeployadas · ROADMAP · STATE
