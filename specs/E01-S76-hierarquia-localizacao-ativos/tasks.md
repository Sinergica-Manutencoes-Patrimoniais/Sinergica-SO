---
name: tasks-E01-S76-hierarquia-localizacao-ativos
description: Quebra em tasks com cobertura de AC e gates executáveis.
alwaysApply: false
---

# Tasks — Hierarquia de localização de ativos + Sistemas

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|-----------|----------------|--------|
| 1 | Migration `0095` (areas, locais+trigger, sistemas+trigger, sistema_itens, extensão equipamentos, RLS+GRANT) | AC-1, AC-2, AC-3, AC-7, AC-9, AC-10 | — | `pnpm run lint:migrations` | ☐ |
| 2 | Migration `0096` VALIDATE das 3 constraints NOT VALID | AC-10 | 1 | `pnpm run lint:migrations` | ☐ |
| 3 [P] | domain `hierarquia.ts` (Area, Local árvore, `montarArvore`, validadores INV 1/2/7) + `.test.ts` | AC-2, AC-3 | — | `pnpm test` | ☐ |
| 4 [P] | domain `sistemas.ts` (Sistema, validadores INV 5/6) + `.test.ts` | AC-7 | — | `pnpm test` | ☐ |
| 5 [P] | domain estender `equipamentos.ts` (`localId,tipo,parentItemId`, `ItemContexto`) + testes | AC-4, AC-5, AC-6 | — | `pnpm test` | ☐ |
| 6 | application `hierarquia-gateway.ts` + `hierarquia.ts` (use-cases + validação) | AC-1, AC-2, AC-3 | 3 | `pnpm typecheck` | ☐ |
| 7 | application `sistemas-gateway.ts` + `sistemas.ts` (CRUD + add/remove item) | AC-7, AC-8 | 4 | `pnpm typecheck` | ☐ |
| 8 | application estender equipamentos (`obterContextoItem`) | AC-6 | 5 | `pnpm typecheck` | ☐ |
| 9 | infra `supabase-hierarquia-adapter.ts` | AC-1, AC-2, AC-3 | 1, 6 | `pnpm typecheck` | ☐ |
| 10 | infra `supabase-sistemas-adapter.ts` | AC-7, AC-8 | 1, 7 | `pnpm typecheck` | ☐ |
| 11 | infra estender `supabase-equipamentos-adapter.ts` (colunas + join + breadcrumb) | AC-4, AC-5, AC-6 | 1, 8 | `pnpm typecheck` | ☐ |
| 12 | Auvo `registry/sistemas.ts` (`/equipments`, `writeEnabled:false`) + registrar em `index.ts` | AC-8 | 1 | `pnpm typecheck` / smoke edge | ☐ |
| 13 | UI Estrutura do cliente (árvore Área>Local CRUD) + wiring `HomePage.tsx` | AC-1, AC-2 | 9 | `pnpm build` | ☐ |
| 14 | UI Detalhe do Item (breadcrumb + chips de sistema; componentes aninhados) | AC-5, AC-6 | 11 | `pnpm build` | ☐ |
| 15 | UI Sistemas (CRUD + seletor de itens + codigo/status) | AC-7 | 10 | `pnpm build` | ☐ |
| 16 | UI EquipamentosPage: filtro tipo + local_id + parent_item_id | AC-4, AC-5 | 11 | `pnpm build` | ☐ |
| 17 | pgTAP RLS das 4 tabelas novas (por efeito) | AC-9 | 1 | `supabase test db` (`db-tests` CI, exige Docker) | ☐ |
| 18 | Playwright e2e no dev server local (fluxo completo) | AC-1..AC-8 | 13, 14, 15, 16 | `pnpm exec playwright test` | ☐ |
| 19 | ADR + glossário + ROADMAP + STATE | — | todas | `pnpm run audit:esteira` / `eval:spec` | ☐ |

`[P]` = paralelizável. Um commit por task, escopo `feat(E01-S76): ...`.

## Plano de teste
- **Unit (Vitest):** validadores de domínio — árvore sem ciclo (INV 1), área consistente (INV 2), tipo válido (INV 3),
  parent mesmo cliente (INV 4), membro mesmo cliente (INV 5). Montagem de árvore e resolução de breadcrumb.
- **Integração/RLS (pgTAP, `db-tests`):** leitura/escrita por papel nas 4 tabelas, por efeito (contagem). **Não pode ser pulado** (exige Docker/CI).
- **Aceitação (Playwright, dev server local — NUNCA URL Netlify de produção):** criar Área "Torre A" → Local "3º andar"
  → sub-local "Sala 302" → atribuir equipamento ao local → criar "Sistema de Hidrante Torre A" com N itens → abrir o
  Item e confirmar breadcrumb + chip do sistema. Confirmar que criar Sistema enfileira no outbox mas não grava no Auvo (dry-run).

## SPEC_DEVIATION
(nenhum até agora — registrar aqui qualquer divergência com `// SPEC_DEVIATION:` no código)

## Definition of Done
- [ ] AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10 verdes **pelo comando** (não inspeção).
- [ ] `pnpm run ci:local` verde (lint:migrations/lint/typecheck/test/build/arch:check/audit:esteira/eval:spec).
- [ ] `db-tests` (pgTAP RLS) verde no CI — não pulado silenciosamente.
- [ ] Playwright e2e verde no dev server local.
- [ ] Descriptor `sistemas` `writeEnabled:false` confirmado (dry-run).
- [ ] ADR registrado · glossário, ROADMAP, STATE atualizados · zero SPEC_DEVIATION pendente.
- [ ] Revisão adversarial (`/revisao-adversarial`) antes do PASS.
