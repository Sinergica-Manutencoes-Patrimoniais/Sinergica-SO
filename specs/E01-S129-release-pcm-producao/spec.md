---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Release do PCM para produção (checklist / hardening)

> **Fonte da verdade.** Origem: pedido do Lucas (2026-08-04, item 10). "Vamos soltar para produção o
> PCM, precisamos ter certeza que tudo está operacional." Decisão travada: **checklist de
> release/hardening — sem feature nova.**

## Contexto
Muitas stories do E01 estão "implementadas localmente" com **migration não aplicada em produção**
(ver ROADMAP, coluna Status: 0100/0101/0102 e várias 015x/016x pendentes). Antes de "soltar", é
preciso reconciliar o que está em código vs o que está em produção, aplicar o que falta com
verificação, e passar os gates de verdade (não só o caminho feliz).

## Resumo
Story de QA/devops que **fecha o PCM para produção**: inventário de migrations pendentes → aplicar
com verificação → Playwright verde → smoke das Edge Functions → revisão adversarial dos fluxos
críticos (Chamado→OS→Auvo) → confirmar RLS/segurança → sign-off. Sem código funcional novo (se
aparecer bug bloqueador, vira story própria e é referenciada aqui).

## Critérios de aceite

### AC-1: Inventário de migrations pendentes
- **Dado** o estado local vs produção (`supabase migration list --linked`)
- **Quando** o inventário roda
- **Então** existe uma lista clara de quais migrations faltam em produção e o que cada uma faz.

### AC-2: Migrations pendentes aplicadas e verificadas
- **Dado** as migrations pendentes do PCM
- **Quando** aplicadas (`supabase db push --linked`)
- **Então** `migration list --linked` confirma todas aplicadas; nenhuma tabela nova sem RLS FORCE.

### AC-3: Playwright verde nos fluxos do PCM
- **Dado** o dev server apontando pro Supabase real
- **Quando** a suíte Playwright do PCM roda
- **Então** os fluxos críticos passam (Operação/board, Chamado→OS, Backlog GUT, Inspeções, PMOC).

### AC-4: Edge Functions do PCM operacionais (smoke)
- **Dado** as Edge Functions do PCM em produção (auvo sync/webhook/push, etc.)
- **Quando** o smoke test roda
- **Então** cada uma responde ACTIVE (401/HMAC esperado sem auth, não 404) — nenhuma órfã
  (`scripts/check-edge-functions.mjs`, E00-S11).

### AC-5: Revisão adversarial dos fluxos críticos
- **Dado** o fluxo Chamado→OS→Auvo (e Saúde Auvo)
- **Quando** a revisão adversarial roda (`/revisao-adversarial`)
- **Então** borda/erro parcial/concorrência estão cobertos ou viram achado documentado; nenhum
  SPEC_DEVIATION crítico pendente.

### AC-6: Segurança confirmada
- **Dado** o schema `pcm` em produção
- **Quando** auditado
- **Então** RLS FORCE em toda tabela, `service_role` nunca no client, secrets em Vault, sem dívida
  nova não registrada em `docs/SECURITY_DEBT.md`.

### AC-7: Sign-off
- **Dado** AC-1..AC-6 verdes
- **Quando** o release é declarado
- **Então** `docs/STATE.md` e ROADMAP refletem "PCM em produção", com data e escopo do que entrou.

## Casos de borda e erros
- Migration que falha ao aplicar em prod (dado incompatível): parar, não forçar; abrir fix.
- Bug bloqueador achado no Playwright/adversarial: vira story própria, referenciada; release espera.
- Sem Docker local: pgTAP/db-tests só no CI — confirmar que o job `db-tests` não foi pulado (DoD).

## Fora de escopo
- Qualquer feature nova (itens 1-9 são stories próprias; bloqueadores viram referência aqui).
- Deploy de outros épicos (E02/E04/E09) — este release é o PCM.

## Rastreabilidade
- Processo: `Definition-of-Done.md`, `/revisao-adversarial`, `scripts/check-edge-functions.mjs`.
- Estado: `docs/STATE.md`, `docs/epics/ROADMAP.md`, `docs/SECURITY_DEBT.md`.
- ADRs relacionados: —
