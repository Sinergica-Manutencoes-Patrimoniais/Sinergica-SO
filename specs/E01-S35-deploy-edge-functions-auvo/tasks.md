---
name: tasks
description: Decomposição e gates — deploy das Edge Functions Auvo + secrets + webhooks + smoke-test.
alwaysApply: false
---

# Tasks — Deploy das Edge Functions Auvo + secrets + webhooks

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | `design.md` + ADR de estratégia de deploy: decidir e registrar o mecanismo canônico (integração nativa Supabase↔GitHub **ou** `deploy.yml`), com matriz `verify_jwt` por função | AC-6 | — | revisão humana (Lucas) | done |
| 2  | Declarar todas as funções em `supabase/config.toml` (`[functions.<nome>]` + `verify_jwt` conforme matriz da task 1); públicas (webhook) sem JWT, internas com JWT | AC-1 | 1 | `node scripts/check-edge-functions.mjs` (de E00-S11) verde | done |
| 3  | Reativar o CD de funções: trigger de push em `main` no `.github/workflows/deploy.yml` (ou confirmar a integração nativa), deploy de todas as funções | AC-1, AC-6 | 2 | deploy roda no merge (evidência no Actions) | done |
| 4  | Step de smoke-test no CD: pinga cada função declarada pós-deploy; falha o job em qualquer 404 | AC-5 | 3 | job de smoke-test vermelho quando função ausente (teste com função removida temporariamente) | done |
| 5  | Runbook `runbooks/deploy-edge-functions.md`: mecanismo canônico, lista de secrets (`AUVO_API_KEY`, `AUVO_USER_TOKEN`, Vault `auvo_trigger_*`) e como setar cada um | AC-4, AC-6 | 1 | revisão humana | done |
| 6  | Rodar `pcm-auvo-webhooks-register` uma vez pós-deploy e confirmar idempotência | AC-3 | 3 | invocação retorna ok; segunda execução não duplica | done |
| 7  | Smoke manual: abrir tela Tickets em dev/staging (nunca prod Netlify) e confirmar 200 em `pcm-auvo-tickets-referencia` | AC-2 | 3, 4 | tela renderiza selects, sem 404 no console | done |
| 8  | `pnpm run ci:local` + atualizar ROADMAP/STATE | todos | 1–7 | `pnpm run ci:local` | done |

> **Manual (Lucas), não codificável:** setar os valores dos secrets no dashboard Supabase antes do smoke-test.

## Plano de teste
- Integração/infra: smoke-test do CD (função ausente ⇒ job vermelho).
- Estático: `check-edge-functions.mjs` verde após declarar tudo (AC-1).
- Aceite manual: tela Tickets 200 (AC-2), webhooks registrados idempotentes (AC-3), em dev/staging.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] ADR de estratégia de deploy registrado (task 1)
- [ ] Runbook de deploy criado
- [ ] Spec reflete o que foi construído
- [ ] `docs/STATE.md` atualizado
