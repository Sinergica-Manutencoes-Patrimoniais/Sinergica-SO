---
name: tasks
description: Decomposição e gates do rename de papéis RBAC. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Renomear papéis RBAC

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|-----------------|--------|
| 1  | Criar usuário `sinergicaengenharia@gmail.com` no Supabase Auth (Admin API) | AC-6 | — | `GET /auth/v1/admin/users` mostra o usuário | done |
| 2  | Provisionar com papel `admin` (valor válido hoje) via `config.provisionar_usuario` — a task 5 remapeia para `superadmin` quando a migration mergear | AC-6 | 1 | `select * from config.usuarios where user_id = ...` | done |
| 3  | Migration `0004`: drop constraint, remap dados, `alter policy` nas ~19 policies, add constraint nova `not valid` + `0005`: `validate constraint` em transação separada (Squawk `constraint-missing-not-valid`) | AC-1, AC-2, AC-3 | — | `pnpm run lint:migrations` limpo | done |
| 4  | `role.ts`: `Papel` = `"superadmin" \| "supervisor" \| "colaborador" \| "cliente-sindico"` `[P]` | AC-5 | — | `pnpm --filter @sinergica/web test -- role` | todo |
| 5  | `role.test.ts`: atualizar literais testados `[P]` | AC-5 | 4 | idem | todo |
| 6  | `supabase/tests/e00-s05_rbac.test.sql`: renomear literais de papel (mesmas 29 asserções) | AC-3, AC-5 | 3 | `supabase test db` (CI, job `db-tests`) | todo |
| 7  | Docs: `README.md`, `CLAUDE.md`, `docs/PROJECT.md`, `docs/ESCOPO-MESTRE.md`, `runbooks/provisionar-usuario.md` `[P]` | — | — | `audit:esteira` | todo |
| 8  | `pnpm run ci:local` de ponta a ponta | AC-1 a AC-5 | 3-7 | `pnpm run ci:local` verde | todo |
| 9  | Merge da PR (usuário decide) → migration `0004` aplica em produção via GitHub Integration nativa → AC-2/AC-6 se resolvem sozinhos | AC-2, AC-6 | 8 | query em produção pós-merge: `select papel from config.usuarios where user_id = 'd3a30ba8-...'` = `superadmin` | todo |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual.

## Plano de teste
- `lint:migrations`: a migration usa `alter policy` (não `create policy`), então o check
  automático de GRANT não dispara para ela — os GRANTs relevantes já existem desde `0001`/`0002`
  (verificado, não precisa de GRANT novo).
- pgTAP (`supabase test db`, CI): as mesmas 29 asserções da matriz de decisão, só com os literais
  de papel renomeados — prova que a permissão não mudou, só o nome.
- Unidade: `role.test.ts` — `isPapel` aceita os 4 novos valores, rejeita os antigos.

## Divergências (SPEC_DEVIATION)
- Nenhuma.

## Checklist de Definition of Done
- [ ] Todos os AC verdes **pelo gate executável**
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] ADR **não** editado (`0003` continua válido — mecanismo não muda, só vocabulário)
- [ ] Glossário — não há tabela de papéis em `docs/glossary.md` hoje (papéis vivem em
      `README.md`/`docs/PROJECT.md`); atualizados na task 7
- [ ] `docs/STATE.md` e `docs/epics/ROADMAP.md` atualizados
- [ ] Usuário `sinergicaengenharia@gmail.com` confirmado como `superadmin` em produção pós-merge
