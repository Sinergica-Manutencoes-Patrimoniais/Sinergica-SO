---
name: E02-S33-gasto-ia-conversa-tasks
description: Tasks executáveis para E02-S33, com correção de SPEC_DEVIATION (componentes errados no spec original)
alwaysApply: false
---

# Tasks — E02-S33 — Gasto de IA na conversa

Owner: Claude (sessão Lucas) · Início: 2026-08-15 · Depende de E02-S31 (`ia.gasto_log`).

## SPEC_DEVIATION
`spec.md` (tasks 1-4) referencia `supabase-historico-chamado-adapter.ts`, `HistoricoChamadoInteracao`
e `ConversaChamado` — nenhum existe. O chat real do Inbox de Atendimento é `ConversaChat.tsx` (bolhas
via `MensagemBubble.tsx`, tipo `MensagemItem` em `domain/mensagens.ts`), carregado por polling manual
em `AtendimentoInboxPage.tsx` (`listarMensagens` → `application/listar-mensagens.ts` →
`supabase-atendimento-adapter.ts`), NÃO por TanStack Query hoje. Corrigindo os nomes abaixo.

## Confirmações contra o codebase
- `MensagemItem` (`domain/mensagens.ts:12-27`) não tem campo de custo — precisa de novo campo.
- `MensagemBubble.tsx:5-11` já distingue `deAgente` (`remetenteTipo === 'ze' || 'agente'`) — é o
  gate certo pro rodapé de custo (só mensagens de IA têm `config.ia_gasto_log.ref_id` preenchido).
- Sem formatter USD existente no repo (os 3 formatters de dinheiro são BRL, 2 casas fixas via
  `Intl.NumberFormat pt-BR`). Criar formatter novo, não reusar.
- `ConversaChat.tsx:100-201` tem o header da conversa — badge de total entra ali, ao lado do badge
  de canal (padrão de `<span className="rounded-full bg-line-soft px-2 py-0.5 ...">` em L114-116).

## Tarefas

1. **Domínio**: `formatarCustoIA(usdCents: number): string` em
   `apps/web/src/features/config/domain/ia-gasto.ts` (mesmo módulo de S31) — formato "$0.0042".
2. **Adapter** `supabase-atendimento-adapter.ts` (`listarMensagens`): join/segunda query em
   `config.ia_gasto_log` filtrando `ref_id in (mensagem.id...)`, mapeado pro novo campo de `MensagemItem`.
3. **Tipo** `domain/mensagens.ts`: `MensagemItem` ganha `custoIaUsd: number | null` (+ `modelo`,
   `tokensIn`, `tokensOut` opcionais pro tooltip do AC-2).
4. **UI** `MensagemBubble.tsx`: rodapé `"IA · $X · HH:MM"` quando `deAgente && custoIaUsd != null`,
   com `title=` (tooltip nativo) mostrando modelo + tokens in/out.
5. **UI** `ConversaChat.tsx`: badge "Total IA: $X.XX" no header, somando `custoIaUsd` de todas as
   mensagens carregadas da conversa atual.
6. **Testes**: unit (`formatarCustoIA`) · Playwright (rodapé aparece só em mensagem de IA, badge
   soma corretamente, hover mostra tooltip).

## Fora de escopo (reafirmado do spec.md)
Refund/recálculo · filtro por custo mínimo.
