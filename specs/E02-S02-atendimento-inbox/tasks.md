---
name: tasks
description: Decomposição e gates — Inbox de Conversas (UI, WhatsApp-only).
alwaysApply: false
---

# Tasks — Inbox de Conversas

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | `domain/conversas.ts` + `domain/mensagens.ts` + testes puros (`filtrarConversas`, `validarTextoMensagem`) | AC-1 | E02-S01 mergeada | `vitest` | feito |
| 2  | `application/atendimento-gateway.ts` + casos de uso (`listar-conversas`, `listar-mensagens`, `enviar-mensagem`, `assumir-conversa`, `devolver-ao-ze`, `marcar-conversa-lida`, `acionar-ze-agora`) + testes | AC-2, AC-3, AC-4, AC-5 | 1 | `vitest` | feito |
| 3  | `infrastructure/supabase-atendimento-adapter.ts` | todos | 2 | `pnpm run typecheck` | todo |
| 4  | `components/{ConversaLista,ConversaChat,ConversaPerfil,MensagemBubble}.tsx` + `pages/AtendimentoInboxPage.tsx` | AC-1 a AC-6 | 3 | `pnpm run build` | todo |
| 5  | Wiring em `HomePage.tsx` (`AtendimentoView`/`ATENDIMENTO_NAV`) | AC-6 | 4 | `pnpm run build` | todo |
| 6  | Rodar `pnpm run ci:local` | todos | 1-5 | `pnpm run ci:local` | feito |
| 7  | Teste manual em browser (dev server + `.env.local` + mensagem real via Evolution) | AC-1 a AC-5 | 6 | manual | pendente |
| 8  | Atualizar ROADMAP/STATE | — | 7 | revisão humana | feito |

## Plano de teste
- Unidade: `filtrarConversas`/`validarTextoMensagem` (domain), casos de uso (delegação +
  validação, mesmo padrão de `criarEquipe`/`criarTicket`).
- Manual: fluxo completo mensagem→conversa→Inbox→resposta (humana e via "Responder com IA
  agora").
- Aceite: os 6 AC de `spec.md`.

## Divergências (SPEC_DEVIATION)
- Nenhuma. A implementação seguiu `design.md` sem desvios — a única decisão de superfície
  (concentrar `assumir`/`devolver` na Edge Function em vez de update direto do adapter) já está
  registrada em `specs/E02-S01-atendimento-fundacao/tasks.md` (é uma decisão da Task 6 de S01, não
  desta story).

## Checklist de Definition of Done
- [x] Todos os AC (AC-1 a AC-6) implementados em código local
- [ ] Todos os AC verdes por teste manual em browser com dado real (pendente — depende de
      `.env.local` + instância Evolution real, mesma ressalva de S01)
- [x] `docs/STATE.md`/`docs/epics/ROADMAP.md` atualizados
- [x] Gates locais verdes: `lint`, `typecheck`, `test` (175 pass/9 skip), `build`, `arch:check`
- [ ] Teste manual em browser executado com dado real (não só gates de código)
