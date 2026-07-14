---
name: tasks
description: Decomposição e gates — import OFX, regras de classificação e conciliação.
alwaysApply: false
---

# Tasks — E04-S02 · Import OFX

> Depende de E04-S01 mergeada. Marcar owner no ROADMAP antes de codar.
> Branch: `feat/E04-S02-import-ofx`.

## Plano
| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Obter/criar fixtures OFX: pedir arquivo real anonimizado ao Lucas; criar sintéticos 1.x SGML e 2.x XML (encoding `windows-1252` e UTF-8) em `domain/__fixtures__/` | AC-1 | insumo PO | — | todo |
| 2 | `domain/ofx.ts` — `parseOfx()` puro (FITID, DTPOSTED, TRNAMT→centavos por string, MEMO/NAME, TRNTYPE, BANKID/ACCTID p/ prévia) + testes com as fixtures | AC-1 | 1 | `pnpm run test` | todo |
| 3 | Migration `NNNN_E04-S02_extrato_ofx.sql`: `extrato_transacoes` (unique `conta_id,fitid`) + `regras_classificacao` + FK `lancamentos.extrato_transacao_id` (`NOT VALID`→`VALIDATE`) — RLS FORCE padrão do épico | AC-2 | S01 | `pnpm run lint:migrations` | todo |
| 4 | `domain/conciliacao.ts` — casamento de candidatos (mesma conta, valor igual, vencimento ±5d), aplicação de regras de classificação (substring case-insensitive) — puro, com testes | AC-3, AC-4 | 2 | `pnpm run test` | todo |
| 5 | Use cases + adapter: importar (dedupe), listar pendentes, conciliar/desfazer, criar lançamento de transação, ignorar/reverter, CRUD regras + "criar regra a partir desta" | AC-2–AC-6 | 3, 4 | `pnpm run test` | todo |
| 6 | `ImportOfxPage`: upload → prévia (novas/duplicadas/sugestões) → confirmar; fila de pendentes com ações conciliar/criar/ignorar | AC-2–AC-6 | 5 | `pnpm run test` | todo |
| 7 | pgTAP RLS das 2 tabelas novas + unique de FITID | AC-2 | 3 | CI `db-tests` | todo |
| 8 | `pnpm run ci:local` + Playwright (importar fixture→classificar→conciliar→reimportar sem duplicar) + ROADMAP/STATE | todos | 1–7 | `pnpm run ci:local` | todo |

## Plano de teste
- Unit: parser (2 formatos, encoding, valores negativos, arquivo corrompido), candidatos de
  conciliação (borda: dois previstos de mesmo valor), regras (acento/caixa).
- Playwright: ciclo completo com fixture; reimport prova idempotência na UI.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] AC verdes pelo comando · `ci:local` verde · revisão adversarial (OFX truncado, FITID
  repetido entre contas distintas — deve permitir) · ROADMAP/STATE atualizados
