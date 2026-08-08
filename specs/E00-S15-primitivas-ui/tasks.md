---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Biblioteca de primitivas UI

> Home e dependências fechadas em **ADR-0017**: primitivas em `packages/ui`; Radix headless
> apenas nas de sobreposição; `zod` (já existente) para validação.

## Plano
| #  | Task                                                                        | Cobre AC | Depende de | Gate (comando)                                  | Status |
|----|-----------------------------------------------------------------------------|----------|------------|--------------------------------------------------|--------|
| 1  | `packages/ui` sai de placeholder: build, tipos, export, consumo pelos 2 apps | AC-2    | —          | `pnpm run build`                                 | todo   |
| 2  | Instalar `@radix-ui/react-{dialog,popover,tooltip,select}`                  | AC-6     | 1          | `pnpm run build`                                 | todo   |
| 3  | Tokens de raio (`--radius-*`) + codemod dos 877 `rounded-[Npx]`             | AC-1     | —          | `node scripts/check-primitivas.mjs --radius`     | todo   |
| 4  | `Button` (5 variantes, 2 tamanhos, `:active`, `loading` sem salto)          | AC-3     | 1,3        | `pnpm run test -- ui/Button`                      | todo   |
| 5  | `Badge` (6 tones ligados aos tokens de S14)                                 | AC-4     | 1,3        | `pnpm run test -- ui/Badge`                       | todo   |
| 6  | `Card` + `EmptyState` (absorve `.surface-card`/`.empty-state`)              | AC-1     | 1,3        | `pnpm run test -- ui/Card`                        | todo   |
| 7  | `Field` + `Input`/`Select`/`Textarea` com `aria-*` derivado                 | AC-7     | 1,3        | `pnpm run test -- ui/Field`                       | todo   |
| 8  | `useValidacaoCampo` sobre `zod` — valida no `blur`, limpa na digitação      | AC-8, AC-9 | 7        | `pnpm run test -- validacao-campo`                | todo   |
| 9  | Envio foca e anuncia o primeiro campo inválido                              | AC-8     | 8          | `pnpm run test -- validacao-campo`                | todo   |
| 10 | `Field` aceita erro vindo do servidor no próprio campo                      | AC-8     | 7,8        | `pnpm run test -- ui/Field`                       | todo   |
| 11 | `Modal` sobre `@radix-ui/react-dialog`, estilizado só com nossos tokens     | AC-6     | 2,3        | `pnpm run test -- ui/Modal`                       | todo   |
| 12 | `DataTable` (sticky, scroll contido, ordenação, vazio, carregando)          | AC-5     | 1,3,5      | `pnpm run test -- ui/DataTable`                   | todo   |
| 13 | Migrar `Tooltip.tsx` de `apps/web` para `packages/ui`                      | AC-2     | 1,2        | `node scripts/check-primitivas.mjs`               | todo   |
| 14 | `scripts/check-primitivas.mjs` — `<table`, `modal-backdrop`, `<button className=`, raio, e domínio em `packages/ui` | AC-1, AC-2, AC-3, AC-5, AC-6 | 4,11,12 | `node scripts/check-primitivas.mjs` | todo |
| 15 | Migrar os 28 modais inline para `Modal`                                     | AC-6     | 11,14      | `node scripts/check-primitivas.mjs --modal`       | todo   |
| 16 | Migrar as 13 tabelas manuais para `DataTable`                               | AC-5     | 12,14      | `node scripts/check-primitivas.mjs --table`       | todo   |
| 17 | Migrar botões das telas para `Button` (por diretório, `[P]`)                | AC-3     | 4,14       | `node scripts/check-primitivas.mjs --button`      | todo   |
| 18 | Migrar badges/pills para `Badge` `[P]`                                      | AC-4     | 5          | `node scripts/check-primitivas.mjs --badge`       | todo   |
| 19 | Migrar os 12 formulários para `Field` + validação por campo                 | AC-7, AC-8 | 7,8,9,10 | `pnpm run e2e -- validacao-formulario`            | todo   |
| 20 | Galeria `/ui` (dev + `superadmin`), todas as variantes × 2 temas            | AC-10    | 4–12       | `pnpm run e2e -- galeria-ui`                      | todo   |
| 21 | Provar que o bundle do portal continua isolado (E09-S11)                    | AC-2     | 15,16,17   | `pnpm run check:bundle-portal`                    | todo   |
| 22 | Plugar `check-primitivas.mjs` no pre-push                                   | AC-1, AC-3, AC-5, AC-6 | 14 | `pnpm run ci:local`                          | todo   |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual.

## Plano de teste
- Unidade: cada primitiva — variantes renderizam, `disabled`/`loading` bloqueiam clique,
  `Field` deriva `aria-describedby`, `Badge` mapeia tone→token, `useValidacaoCampo` não acusa
  antes do primeiro `blur` e limpa o erro na digitação válida.
- Integração: `Modal` prende e devolve o foco; `Escape` fecha; scroll do body trava/destrava.
- Contrato (estático): 0 `<table`, 0 `modal-backdrop`, 0 `rounded-[Npx]`, 0 `<button className=`
  fora de `packages/ui`; 0 referência de domínio dentro de `packages/ui`.
- Aceite: galeria `/ui` nos 2 temas; formulário acusa erro no `blur` e foca o primeiro inválido
  no envio; bundle do portal sem regressão.

## Risco conhecido
Tasks 15–19 tocam ~100 arquivos. **Um PR por diretório de feature**, nunca um PR único —
revisão de 100 arquivos não acontece de verdade.

Task 19 é a mais delicada do lote: mexe em formulário que grava dado real. Migrar **um**
formulário primeiro (sugestão: `ClienteFormModal`, já componentizado), validar em produção, e só
então seguir para os outros 11.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] Todos os AC verdes **pelo gate executável**
- [ ] ADR-0017 refletido: primitivas em `packages/ui`, Radix só nas de sobreposição
- [ ] `check-primitivas.mjs` no pre-push
- [ ] Gate anti-vazamento de bundle do portal (E09-S11) verde
- [ ] `docs/STATE.md` atualizado
