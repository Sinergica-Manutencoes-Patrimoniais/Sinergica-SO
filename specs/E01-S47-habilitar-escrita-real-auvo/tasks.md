---
name: tasks
description: Decomposição e gates — habilitação controlada de escrita real no Auvo.
alwaysApply: false
---

# Tasks — Escrita real PCM→Auvo por entidade

| # | Task | Cobre AC | Gate | Status |
|---|------|----------|------|--------|
| 1 | Validar contrato vivo de funcionários com registro reversível; anonimizar request/response e registrar no `design.md`. | AC-1, AC-4 | curl + GET de confirmação + limpeza | **bloqueado — a conta Auvo retornou `errorCode: 56` (limite máximo de usuários); nenhum registro foi criado.** |
| 2 | Repetir a validação para categoria de equipamento, ferramenta e cliente, respeitando a ordem e interrompendo a entidade que divergir. | AC-1, AC-4 | curl + GET de confirmação + limpeza por entidade | pendente |
| 3 | Para cada entidade aprovada, cobrir o mapeamento no teste Deno, habilitar `writeEnabled`, adaptar banners e provar o fluxo pelo outbox. | AC-2, AC-3 | `deno test supabase/functions/_shared/auvo/registry/` | pendente |
| 4 | Atualizar ADR-0005, ROADMAP e STATE; executar gates e revisão adversarial. | todos | `pnpm run ci:local` | pendente |

## Registro de teste vivo

- Nunca registrar segredos, IDs de clientes reais, telefone, documento, endereço ou payload bruto.
- Todo registro de teste criado no Auvo deve ser removido ou desativado antes de avançar.
- Divergência de payload, resposta inesperada ou falha de limpeza interrompe somente a entidade e
  mantém `writeEnabled: false`.
