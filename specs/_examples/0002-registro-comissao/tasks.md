---
name: tasks
description: Decomposição e gates do registro de comissão (exemplo de referência das camadas com I/O).
alwaysApply: false
---

# Tasks — Registro de comissão

> Cada task mapeia para `AC-N` (token por extenso) e tem gate executável. Um commit por task.
> Demonstra a ordem das camadas: domínio (porta) → infraestrutura (adapters) → aplicação → borda.

## Plano
| #  | Task                                                                       | Cobre AC          | Depende de | Gate (comando)                                            | Status |
|----|----------------------------------------------------------------------------|-------------------|------------|----------------------------------------------------------|--------|
| 1  | Entidade `RegistroComissao` + porta `RepositorioComissao` (domínio)         | AC-1              | —          | `npx vitest run src/application/registrar-comissao`       | done   |
| 2  | Adapter in-memory + adapter Supabase (infraestrutura) + migration           | AC-1, AC-3        | 1          | `npx vitest run src/application/registrar-comissao`       | done   |
| 3  | Caso de uso `registrarComissao` (cálculo + persistência + idempotência)     | AC-1, AC-3        | 1, 2       | `npx vitest run src/application/registrar-comissao`       | done   |
| 4  | Borda HTTP `handleRegistrarComissao` (Zod, problem+json, log) `[P]`          | AC-1, AC-2        | 3          | `npx vitest run src/interfaces/http/registrar-comissao`   | done   |

## Plano de teste
- Integração (application): `registrarComissao` com adapter in-memory — persistência (AC-1) e
  idempotência (AC-3). Roda na CI **sem banco**.
- Borda (interfaces): `handleRegistrarComissao` — happy path 201 (AC-1) e rejeição 422 (AC-2).
- Produção (Supabase): adapter testado via Supabase local / pgTAP (ver `db/rls-test.md`), fora da CI unitária.

## Divergências (SPEC_DEVIATION)
- [ ] nenhuma.

## Checklist de Definition of Done
- [x] Todos os AC verdes pelo gate executável
- [x] Nenhum `SPEC_DEVIATION` pendente
- [x] Decisão de idempotência por chave de negócio é padrão simples (não exigiu ADR novo)
- [x] Migration com RLS (baseline mínimo) em `db/migrations/`
- [x] Spec marcada como implementada
- [x] `docs/STATE.md` atualizado
