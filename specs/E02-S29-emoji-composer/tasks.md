---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Emoji no composer do Inbox

## Plano
| #  | Task                                                                    | Cobre AC | Depende de | Gate (comando)                       | Status |
|----|--------------------------------------------------------------------------|----------|------------|----------------------------------------|--------|
| 1  | `Popover` em `packages/ui` sobre `@radix-ui/react-popover`               | —        | —          | `pnpm --filter @sinergica/ui exec vitest run Popover` | done |
| 2  | `EmojiPicker.tsx` no Atendimento — conjunto curado por categoria         | AC-1     | 1          | `pnpm run test -- EmojiPicker`         | done   |
| 3  | Inserção na posição do cursor (não sempre no fim)                        | AC-2     | 2          | `pnpm run test -- EmojiPicker`         | done   |
| 4  | Wire no composer principal de `ConversaChat.tsx`                        | AC-1,2   | 2,3        | `pnpm run typecheck`                   | done   |
| 5  | Wire no campo de texto do `RichComposer.tsx`                            | AC-3     | 2,3        | `pnpm run typecheck`                   | done   |
| 6  | `aria-label` + navegação por teclado                                    | AC-4     | 2          | `pnpm run test -- EmojiPicker`         | done   |

## Plano de teste
- Unidade: `EmojiPicker` insere na posição do cursor (não concatena no fim); `aria-label`
  presente; `Escape`/clique fora fecha.
- Aceite: sem Playwright disponível nesta sessão — validação manual do Lucas fica pendente.

## Checklist de Definition of Done
- [x] Todos os AC verdes pelo gate executável (unidade)
- [ ] Validação manual do Lucas (sem navegador disponível nesta sessão)
- [x] `docs/STATE.md` atualizado
