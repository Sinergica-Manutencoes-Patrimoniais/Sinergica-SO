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
| 1 | Criar fixtures sintéticas OFX 1.x SGML e 2.x XML (`windows-1252` e UTF-8) em `domain/__fixtures__/` | AC-1 | — | `pnpm run test` | done |
| 2 | `domain/ofx.ts` — `parseOfx()` puro (FITID, DTPOSTED, TRNAMT→centavos por string, MEMO/NAME, TRNTYPE, BANKID/ACCTID p/ prévia) + testes com as fixtures | AC-1 | 1 | `pnpm run test` | done |
| 3 | Migration `NNNN_E04-S02_extrato_ofx.sql`: `extrato_transacoes` (unique `conta_id,fitid`) + `regras_classificacao` + FK `lancamentos.extrato_transacao_id` (`NOT VALID`→`VALIDATE`) — RLS FORCE padrão do épico | AC-2 | S01 | `pnpm run lint:migrations` | done |
| 4 | `domain/conciliacao.ts` — casamento de candidatos (mesma conta, valor igual, vencimento ±5d), aplicação de regras de classificação (substring case-insensitive) — puro, com testes | AC-3, AC-4 | 2 | `pnpm run test` | done |
| 5 | Use cases + adapter: importar (dedupe), listar pendentes, conciliar/desfazer, criar lançamento de transação, ignorar/reverter, CRUD regras + "criar regra a partir desta" | AC-2–AC-6 | 3, 4 | `pnpm run test` | done |
| 6 | `ImportOfxPage`: upload → prévia (novas/duplicadas/sugestões) → confirmar; fila de pendentes com ações conciliar/criar/ignorar | AC-2–AC-6 | 5 | `pnpm run test` | done |
| 7 | pgTAP RLS das 2 tabelas novas + unique de FITID | AC-2 | 3 | CI `db-tests` | done |
| 8 | `pnpm run ci:local` + Playwright (importar fixture→classificar→conciliar→reimportar sem duplicar) + ROADMAP/STATE | todos | 1–7 | `pnpm run ci:local` | done |
| 9 | Validar parser com OFX real anonimizado do banco da Sinérgica | AC-1 | insumo do usuário | UAT manual pós-merge | todo |

## Plano de teste
- Unit: parser (2 formatos, encoding, valores negativos, arquivo corrompido), candidatos de
  conciliação (borda: dois previstos de mesmo valor), regras (acento/caixa).
- Playwright: ciclo completo com fixture; reimport prova idempotência na UI.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma divergência aberta. O OFX real anonimizado continua sendo insumo de UAT explicitado
  na spec; as fixtures sintéticas cobrem os dois formatos enquanto esse arquivo não é fornecido.

## Checklist de Definition of Done
- [x] Gates automatizados, `ci:local`, Playwright e revisão adversarial verdes.
- [ ] UAT externo pós-merge com OFX real anonimizado — depende do arquivo fornecido pelo usuário.
