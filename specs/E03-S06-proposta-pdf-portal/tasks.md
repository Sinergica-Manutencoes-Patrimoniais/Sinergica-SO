---
name: tasks
description: Decomposição e gates — PDF da proposta, publicação no portal e aceite/recusa movendo a oportunidade.
alwaysApply: false
---

# Tasks — E03-S06 · Proposta: PDF + aprovação no portal

> Antes de codar: marcar owner no `docs/epics/ROADMAP.md` (E03).
> Branch: `feat/E03-S06-proposta-pdf-portal`. **Depende de S04 mergeada.**

## Plano

| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | **Task obrigatória antes de codar**: ler a implementação da E09-S09 (`0144_E09-S09_portal_orcamentos.sql` — RPC de decisão, guarda de validade, idempotência) e do PDF (E01-S135/S139). Esta story **replica o padrão**, não inventa outro | AC-1, AC-5, AC-7, AC-8 | — | leitura + anotação nesta tabela | todo |
| 2 | Migration `NNNN_E03-S06_portal_propostas.sql`: view `comercial.portal_propostas` (`security_invoker`, filtra por `config.usuario_cliente`, só status `enviada`/`aceita`/`recusada`) + **`grant select` explícito** (view não herda grant — bug real da E04-S04, corrigido em `0110`) | AC-3, AC-4 | — | `pnpm run lint:migrations` | todo |
| 3 | Migration `NNNN_E03-S06_decisao_proposta.sql`: `comercial.proposta_decisoes` (1 por proposta, `unique`) + RPC `fn_decidir_proposta(proposta_id, decisao, motivo)` `security definer`: valida validade (AC-7), grava decisão, muda status e **move a oportunidade** para etapa `ganha`/`perdida` com evento; `on conflict do nothing` garante idempotência no banco (AC-8) | AC-5, AC-6, AC-7, AC-8 | 2 | `pnpm run lint:migrations` | todo |
| 4 | Geração do PDF a partir do **snapshot da versão** (`proposta_versoes.payload`), não das tabelas ao vivo — reusa o pipeline de PDF existente e a identidade visual da E01-S139 | AC-1, AC-2 | — | `pnpm run test` | todo |
| 5 | Ação "enviar": gera PDF, muda status para `enviada`, publica no portal. **Se o PDF falhar, o status não muda** (ordem das operações importa) | AC-1, AC-3 | 4 | `pnpm run test` | todo |
| 6 | Aviso quando a Conta não tem usuário de portal — oferece o PDF para envio manual sem bloquear o status | AC-3 | 5 | `pnpm run test` | todo |
| 7 | Tela do portal (`features/area-cliente`): lista de propostas do síndico, visualização do PDF, botões aceitar/recusar (recusa exige motivo), marcação de expirada | AC-4, AC-6, AC-7 | 2, 3 | `pnpm run test` | todo |
| 8 | Degradação quando não existe etapa `ganha`/`perdida` ativa: grava a decisão, não move a oportunidade, avisa o time — **a decisão do cliente nunca se perde** | AC-5, AC-6 | 3 | `pnpm run test` | todo |
| 9 | pgTAP `supabase/tests/comercial_portal_proposta_rls.test.sql`: síndico A não vê proposta de B; rascunho não aparece no portal; decisão em proposta expirada recusada; segunda decisão ignorada sem erro | AC-4, AC-7, AC-8 | 2, 3 | CI `db-tests` | todo |
| 10 | `pnpm run ci:local` + Playwright (dev server local): aprovar→enviar→abrir como síndico→aceitar→conferir oportunidade em etapa `ganha`; e o caminho de recusa com motivo + ROADMAP/STATE | todos | 1–9 | `pnpm run ci:local` | todo |

## Plano de teste
- **pgTAP** é o gate principal desta story: o isolamento entre síndicos (AC-4) e a idempotência da
  decisão (AC-8) precisam ser provados no banco, não na UI.
- **Playwright**: o efeito colateral do aceite — a oportunidade mudar de etapa **sozinha** — é o
  que fecha o funil sem trabalho manual; testar os dois caminhos (aceite e recusa).

## Riscos
| Risco | Mitigação |
|-------|-----------|
| View sem `grant select` (bug real da E04-S04) | Explícito na task 2 + pgTAP |
| Proposta "enviada" sem PDF gerado | Ordem das operações na task 5; falha não muda status |
| Dupla decisão movendo a oportunidade duas vezes | `unique` + `on conflict do nothing` no banco (task 3), não só na UI |
| Funil sem etapa `ganha`/`perdida` perder a decisão do cliente | Task 8 grava a decisão de qualquer forma |

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate
- [ ] `pnpm run ci:local` verde · Playwright rodado contra dev server local
- [ ] Revisão adversarial (borda: Conta sem portal, proposta expirada, duplo aceite, funil sem etapa ganha)
- [ ] ROADMAP/STATE atualizados
