---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Release do PCM para produção

> Story de QA/devops (sem feature nova). `@devops` conduz. Bloqueadores achados viram story própria.

## Plano
| #  | Task | Cobre AC | Gate (comando) | Status |
|----|------|----------|----------------|--------|
| 1 | Inventário: `supabase migration list --linked` vs local; listar pendentes + o que fazem | AC-1 | manual | todo |
| 2 | Aplicar migrations pendentes do PCM com verificação; conferir RLS FORCE em cada tabela nova | AC-2,AC-6 | supabase db push / lint:migrations | todo |
| 3 | Rodar Playwright do PCM contra o Supabase real; corrigir/registrar falhas | AC-3 | playwright (Lucas) | todo |
| 4 | Smoke das Edge Functions PCM (ACTIVE, sem órfã) | AC-4 | check-edge-functions.mjs | done local — 35 funções declaradas, 11 invokes verificados; smoke remoto ACTIVE ainda depende de deploy |
| 5 | Revisão adversarial Chamado→OS→Auvo + Saúde Auvo; achados viram teste/story | AC-5 | /revisao-adversarial | done local — `0171` impede OS duplicada no retry; smoke remoto pendente |
| 6 | Auditoria de segurança do schema `pcm` (RLS, service_role, Vault); dívida em SECURITY_DEBT | AC-6 | manual | done local — RLS/Vault/Edges revisados; confirmação SQL em produção é SEC-001 |
| 7 | Sign-off: STATE.md + ROADMAP "PCM em produção" (data, escopo) | AC-7 | audit:esteira | todo |

## Dependências (bloqueadores candidatos)
- Itens 1-9 desta rodada (E01-S120..S127, E02-S27) — decidir quais são pré-requisito de "operacional"
  antes do sign-off (provavelmente E01-S124 drag e E01-S123 saúde Auvo são bloqueadores; E01-S125
  muda comportamento de Auvo — alinhar se entra antes ou depois do release).

## Plano de teste
- `pnpm run ci:local` verde; `gh pr checks` sem check obrigatório pulado (db-tests não pode ter sido skip).
- Playwright PCM verde; smoke edge; adversarial sem achado crítico aberto.

## Checklist de Definition of Done
- [ ] AC-1..AC-7 verdes
- [ ] Migrations pendentes aplicadas e confirmadas em produção
- [ ] Playwright + smoke + adversarial ok
- [ ] STATE.md + ROADMAP atualizados ("PCM em produção")
