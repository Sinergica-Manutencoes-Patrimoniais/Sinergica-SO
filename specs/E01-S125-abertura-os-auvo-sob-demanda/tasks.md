---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Abertura de OS no Auvo sob demanda

> Tier arquitetural. **Aprovar design + ADR-0015 antes de codar.** Deno/Auvo não roda local (sem
> Deno CLI) — validar no CI/produção. Migration mexe em trigger de produção: `squawk` + cuidado.

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 0 | **Auditar todos os produtores de task Auvo** (trigger, Zé/WhatsApp, portal, webhook) — quem depende do automático? Documentar no design | AC-1(risco) | — | revisão | done — matriz em `design.md` (2026-08-06) |
| 1 | ADR-0015: registrar a mudança automático→sob-demanda (reversível via novo trigger) | — | 0 | audit:esteira | done — ADR aceito em 2026-08-04 |
| 2 | Migration `NNNN`: remove/desativa trigger `fn_auvo_create_task_on_planejamento` (mantém função de payload); comentário squawk se necessário | AC-1 | 1 | lint:migrations | done — `0168`, lint PASS |
| 3 | Edge Function de abertura com `dryRun` (monta payload sem efeito / cria idempotente gravando `auvoTaskId`) | AC-3,AC-5,AC-6 | 2 | (deno CI) | done local — `pcm-auvo-open-task`; Deno CI pendente |
| 4 | Application/adapter: `previewAberturaAuvo` (dry-run) e `abrirOsNoAuvo` (confirma) | AC-2..AC-7 | 3 | typecheck+vitest | done — modal invoca Edge; typecheck/vitest PASS |
| 5 | UI: modal "Abrir OS no Auvo?" ao mover pra Planejamento (roda dry-run, confirma/recusa) | AC-2,AC-3 | 4 | typecheck | done — Board, Backlog e conversão por drop; typecheck PASS |
| 6 | UI: botão "Abrir OS Auvo" no `ChamadoPainel`/`DetalheOs` quando `auvoTaskId === null`; idempotente | AC-4,AC-6 | 4 | typecheck | done — `DetalheOs`; typecheck PASS |
| 7 | Resiliência: falha não muda status; "sync pendente"; erro legível; retentar | AC-7 | 4 | vitest | done local — handler legado grava failed, modal mantém botão; 33 testes PASS |
| 8 | e2e: planejar → pergunta → dry-run → confirma cria; recusa fica sem task; botão reabre | AC-2..AC-4 | — | playwright (Lucas) | todo — requer conta/task Auvo real, sem criar resíduos `[TESTE E2E]` |

## Plano de teste
- Unidade: idempotência (auvoTaskId != null → não cria); dry-run sem efeito; bloqueio por campo faltando.
- Aceite: Playwright (Lucas) — os 4 caminhos; **não simular Auvo real** (mesmo cuidado de S81/S98) —
  criação real só validada com task/cliente Auvo reais.
- Deno: handler `dryRun`/create no CI.

## Riscos
- Remover o trigger sem migrar um produtor que dependia dele → OS deixa de ir pro Auvo em algum
  fluxo. Task 0 é bloqueante.

## Checklist de Definition of Done
- [ ] Design + ADR-0015 aprovados
- [ ] Task 0 (auditoria de produtores) concluída
- [ ] AC verdes pelo gate (typecheck/vitest/biome/lint:migrations)
- [ ] Migration aplicada em produção com verificação (`supabase migration list --linked`)
- [ ] Playwright local (Lucas)
- [ ] ROADMAP.md + STATE.md atualizados
