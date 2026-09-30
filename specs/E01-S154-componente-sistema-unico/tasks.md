---
name: tasks-E01-S154
description: Tasks da E01-S154 — renomear UI para Componente, esconder tipo/pai, Sistema 1:N.
alwaysApply: false
---

# Tasks — E01-S154 Componente (renomear) + Sistema 1:N

> Um commit por task: `feat(E01-S154): ...`. Paths relativos a `apps/web/src/` salvo indicação.
> Gate web: `pnpm --filter @sinergica/web exec vitest run <arquivo>`.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | **Pré-checagem de duplicatas (somente leitura).** Rode no projeto Supabase linked: `select item_id, array_agg(sistema_id) from pcm.sistema_itens group by item_id having count(*) > 1;`. Resultado vazio: siga. Com linhas: **PARE**, reporte a lista ao Lucas e aguarde. | AC-3 | — | query retorna 0 linhas | todo |
| 2 | **Migration** `supabase/migrations/NNNN_E01-S154_sistema_itens_item_unico.sql` (NNNN = próximo livre): `create unique index if not exists uq_sistema_itens_item_unico on pcm.sistema_itens (item_id);` + `drop index if exists pcm.idx_sistema_itens_item;` (redundante). pgTAP novo `supabase/tests/pcm_sistema_itens_unico.test.sql`: `has_index`, e `throws_ok` inserindo o mesmo item em 2 sistemas (use o padrão de fixtures de `hierarquia_localizacao_rls.test.sql`). Aplique com `supabase db push` só depois do gate local. | AC-3 | 1 | `supabase test db` (CI `db-tests`) | todo |
| 3 | **Domínio**: em `features/pcm/domain/sistemas.ts`, adicione `validarMembroSemOutroSistema(itemId, sistemaAtualId, pertencimento: { sistemaId: string; sistemaNome: string } \| null)`. Lança o erro literal do AC-4 quando `pertencimento` existe e `pertencimento.sistemaId !== sistemaAtualId`. Em `composicao-sistema.ts`, `ItemComposicaoSistema` ganha `sistemaOutroNome?: string \| null`. Testes em `sistemas.test.ts`: mesmo sistema ok, outro sistema lança, sem pertencimento ok. | AC-4 | — | `vitest run src/features/pcm/domain/sistemas.test.ts` | todo |
| 4 | **Gateway/adapter**: `SistemaItemOpcao` (`application/sistemas-gateway.ts`) ganha `sistemaId: string \| null; sistemaNome: string \| null`. `supabase-sistemas-adapter.ts#listarItensDisponiveis` passa a fazer um 2º select em `sistema_itens` (`item_id, sistema_id`) filtrado pelos ids retornados, mais `sistemas(nome)` para os sistema_ids, e monta o mapa. Mantenha o filtro `.eq('client_id', clienteId)`. | AC-4 | 3 | `pnpm --filter @sinergica/web run typecheck` | todo |
| 5 | **Caso de uso**: `application/sistemas.ts#adicionarItem` chama `validarMembroSemOutroSistema` usando o item encontrado em `listarItensDisponiveis`. Troque o comentário do topo ("um Item pode entrar em >1 Sistema") pela regra nova. Teste em `application/sistemas.test.ts` com gateway fake: item em outro sistema → rejeita e **não** chama `gateway.adicionarItem`. | AC-4 | 3, 4 | `vitest run src/features/pcm/application/sistemas.test.ts` | todo |
| 6 | **UI composição**: `ComposicaoSistema.tsx` monta `ItemComposicaoSistema` com `sistemaOutroNome` = `sistemaNome` quando `sistemaId !== sistemaAtual`. `SeletorItensComFiltro.tsx`: item com `sistemaOutroNome` fica com checkbox `disabled` e mostra `<span className="text-micro text-ink-3">em «{nome}»</span>`. | AC-4 | 4 | typecheck + `vitest run src/features/pcm/domain/composicao-sistema.test.ts` | todo |
| 7 | **Modal sem tipo/pai**: em `EquipamentoModal.tsx`, remova os `<select>` "Tipo" e "Equipamento pai" e a variável `paisDisponiveis`. O estado inicial continua lendo `equipamento?.tipo ?? "equipamento"` e `equipamento?.parentItemId ?? ""`, que são reenviados sem mudança. A prop `equipamentosDisponiveis` pode sair **se** não tiver outro uso (confira os chamadores: `EquipamentosPage`, `DrawerDetalheAtivo`). | AC-2 | — | typecheck | todo |
| 8 | **Renomear textos (AC-1)**. Para cada arquivo listado em "Rastreabilidade" da spec, troque só strings visíveis (JSX, `titulo=`, `label=`, `placeholder=`, mensagens de `Error`, toasts) que se referem a linha de `pcm.equipamentos`. **Não** toque em identificadores. Respeite as exceções da spec. No drawer, a seção de filhos vira "Subcomponentes (legado)". Ajuste testes que fazem assert de texto (`*.test.ts(x)` e `apps/web/e2e/*.spec.ts` que usam "Equipamento": `board-ativos`, `hierarquia-sistemas`, `ordens-servico`, `ferramentas` — confira com `rg -l "quipamento" apps/web/e2e`). | AC-1 | 7 | `rg -n "\"[^\"]*[Ee]quipamento" apps/web/src/features/pcm/components/{EquipamentoModal,BoardAtivos,PainelItensDoCliente,ComposicaoSistema}.tsx apps/web/src/features/pcm/pages/{EquipamentosPage,SistemasPage}.tsx` só retorna imports/identificadores + `pnpm run ci:local` | todo |
| 9 | **Glossário** conforme AC-5. | AC-5 | — | `pnpm run audit:esteira` | todo |
| 10 | **E2E**: em `apps/web/e2e/hierarquia-sistemas.spec.ts`, adicione um cenário: cria 2 sistemas e 1 componente no cliente de teste, compõe no Sistema A e verifica que em B o item aparece desabilitado com `em «A»`. Use o cleanup de `e2e/helpers/limpeza-e2e.ts`. | AC-4, AC-1 | 2, 6, 8 | `pnpm --filter @sinergica/web run test:e2e hierarquia-sistemas` | todo |

## Plano de teste
- Unidade: `validarMembroSemOutroSistema`, `adicionarItem` (gateway fake).
- Integração: pgTAP do índice único.
- Aceite: E2E da task 10 (AC-4) + asserts de texto novos (AC-1).

## Divergências (SPEC_DEVIATION)
- [ ] (vazio)

## Checklist de Definition of Done
- [ ] AC-1..AC-5 verdes pelo gate
- [ ] Migration aplicada em produção depois do merge (task 2) e registrada no PR
- [ ] Glossário atualizado
- [ ] ROADMAP (status) + `docs/STATE.md` atualizados
