---
name: tasks
description: Decomposição e gates — inspeções ABNT NBR 16747 (schema, edição, templates, Storage).
alwaysApply: false
---

# Tasks — E01-S73 · Inspeções profissionais ABNT NBR 16747

> Marcar owner no ROADMAP. Branch: `feat/E01-S73-inspecoes-abnt-16747`. Ler `product.md` + `design.md`
> antes. Tier arquitetural — confirmar volume de dados de inspeção em produção antes da migration.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | ADR: primeiro uso de Supabase Storage no projeto (bucket privado + RLS por módulo). `docs/adr/NNNN-storage-inspecoes.md` | AC-5 | — | revisão | todo |
| 2 | Migration `NNNN_E01-S73_inspecoes_abnt.sql`: colunas aditivas em `pcm.inspecoes` (código, tipo_inspecao_id, edificação, endereço, hora início/fim, inspetor, responsável no local, escopo, norma, ART, condições, anexos) e `pcm.inspecao_itens` (categoria, elemento, identificação, grau_risco, estado_conservacao, anomalia, medicoes, midias, responsavel_acao, observacoes; ampliar CHECK resultado→+nao_aplicavel); tabelas `tipos_inspecao`/`checklist_templates`/`checklist_template_itens` com RLS FORCE | AC-2, AC-3, AC-4, AC-6 | 1 | `pnpm run lint:migrations` | todo |
| 3 | Storage: bucket privado `inspecoes-midia` + policy RLS (upload/leitura por `pcm`); via migration de Storage policy ou passo Dashboard documentado | AC-5 | 1 | manual/migration | todo |
| 4 | Domain `inspecoes-laudos.ts`: entidades/validações de Inspecao/InspecaoItem/TipoInspecao/ChecklistTemplate (resultado 3 valores, grau de risco, obrigatórios do template) — testes unit | AC-2, AC-3, AC-4 | — | `pnpm run test` | todo |
| 5 | application: `editarInspecao`/`editarItem`/`excluirItem`, `criarTipoInspecao`/`editarTipo`, `criarTemplate`/itens, `aplicarTemplate` (pré-carrega itens ao criar). Gateway estendido | AC-1, AC-4 | 4 | `pnpm run test` | todo |
| 6 | infrastructure `supabase-qualidade-adapter.ts`: add `.update()`/`.delete()`; upload/download de mídia via Storage (signed URL) | AC-1, AC-5 | 2, 3, 5 | `pnpm run test` | todo |
| 7 | UI: `InspecoesPage` reconstruída em 2 partes (Dados + Itens) com edição completa + upload de mídia por item; item pré-carregado do template | AC-1, AC-2, AC-3, AC-5 | 6 | `pnpm run test` | todo |
| 8 | UI: admin de templates (`TiposInspecaoPage` / gestão de checklist) — supervisor/superadmin; item na sidebar (CADASTROS ou Configurações) | AC-4 | 6 | `pnpm run test` | todo |
| 9 | pgTAP: RLS das tabelas novas + Storage policy; migração aditiva não perde dados | AC-6 | 2, 3 | CI `db-tests` | todo |
| 10 | `pnpm run ci:local` + Playwright (criar tipo→checklist→inspeção pré-carregada→editar item→subir foto→editar cabeçalho) + ROADMAP/STATE/glossário | todos | 1-9 | `pnpm run ci:local` | todo |

## Plano de teste
- Unit: validações de item (resultado, grau de risco), aplicação de template.
- pgTAP: RLS + Storage policy; dados históricos preservados.
- Playwright: fluxo completo (template → inspeção → mídia → edição).

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] AC verdes · `ci:local` verde (+ `db-tests` no CI) · ADR de Storage registrado · revisão
  adversarial (upload de arquivo grande; RLS de mídia entre módulos; migração com dado existente) ·
  ROADMAP/STATE/glossário atualizados
- [ ] Confirmar volume de inspeções em produção antes da migration (design.md §Riscos)
