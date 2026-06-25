---
name: tasks-E00-S01-login-home
description: Tasks da tela de login e home — decomposição e gates. Registrado retroativamente.
alwaysApply: false
---

# Tasks — E00-S01: Login + Home

> Registrado **retroativamente** após implementação. Para próximas stories, criar tasks.md ANTES de codar.

## Plano
| # | Task | Cobre AC | Gate | Status |
|----|------|----------|------|--------|
| 1 | Instalar Tailwind v4 + @tailwindcss/vite + react-router-dom + lucide-react | — | `pnpm typecheck` | ✅ done |
| 2 | Configurar Tailwind no vite.config.ts + index.css | — | build sem erro | ✅ done |
| 3 | Criar `auth-context.tsx` (mock login, logout, localStorage) | AC-1, AC-2, AC-3, AC-6 | `pnpm typecheck` | ✅ done |
| 4 | Criar `LoginPage.tsx` — formulário com validação e loading | AC-2, AC-3, AC-4 | visual no browser | ✅ done |
| 5 | Criar `HomePage.tsx` — 9 cards com badge "Em construção" | AC-5 | visual no browser | ✅ done |
| 6 | Atualizar `App.tsx` com BrowserRouter + rotas protegidas | AC-1, AC-6 | `pnpm typecheck` | ✅ done |

## Plano de teste
- **Unidade**: AC-1, AC-2, AC-4, AC-6 são candidatos a testes de componente (Vitest + @testing-library/react).
  Não implementados nesta sprint — adicionar na próxima iteração de qualidade.

## Divergências (SPEC_DEVIATION)
- `SPEC_DEVIATION`: story implementada sem processo formal. Ver spec.md.

## Checklist de Definition of Done
- [x] `pnpm typecheck` limpo
- [x] `pnpm lint` limpo
- [x] Dev server renderiza login e home sem erro de console
- [ ] Testes de componente para AC-1, AC-2, AC-4, AC-6 (débito técnico — próxima iteração)
- [x] Spec registrada em `specs/E00-S01-login-home/`
- [x] Story registrada em `docs/epics/ROADMAP.md`
