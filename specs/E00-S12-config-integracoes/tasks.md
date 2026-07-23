---
name: tasks-E00-S12-config-integracoes
description: Tasks — migration Vault-backed + RPC + UI de Integrações.
alwaysApply: false
---

# Tasks — E00-S12: Configurações > Integrações

## Plano
| # | Task | Cobre AC | Gate | Status |
|---|------|----------|------|--------|
| 1 | Migration `0103`: `config.integracoes` (metadado) + RPC `fn_definir_segredo_integracao` (superadmin, Vault create/update) + `fn_integracao_tem_segredo` (só existência) + RLS superadmin-only | AC-1, AC-3, AC-4 | `pnpm run lint:migrations` | ☐ |
| 2 | application `integracoes-gateway.ts`+`integracoes.ts`: listar, salvar metadado, definir segredo, checar status | AC-1, AC-2, AC-3 | `pnpm typecheck` | ☐ |
| 3 | infra `supabase-integracoes-adapter.ts` | AC-1, AC-2, AC-3 | `pnpm typecheck` | ☐ |
| 4 | UI `IntegracoesPage.tsx`: form provedor/e-mail-remetente/ativo + campo de API key (write-only) + badge "chave configurada" | AC-1, AC-2, AC-3 | `pnpm build` | ☐ |
| 5 | Wire `CONFIG_NAV` em `HomePage.tsx` (gate `superadmin`, não `pcm`) | AC-4 | `pnpm build` | ☐ |
| 6 | ROADMAP + STATE | — | `pnpm run ci:local` | ☐ |

## Divergências (SPEC_DEVIATION)
(nenhuma)

## Definition of Done
- [ ] AC-1..AC-5 verdes pelo gate executável
- [ ] `pnpm run ci:local` verde
- [ ] Migration aplicada em produção (autorização pedida antes, mesma disciplina da sessão)
- [ ] ROADMAP + STATE atualizados
