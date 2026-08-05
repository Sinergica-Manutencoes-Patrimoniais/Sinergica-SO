---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Saúde Auvo: drill-down dos erros

> Tier pequeno. Provável só leitura (o detalhe já está em `pcm.auvo_entity_status`). Migration só se
> a view não expuser as colunas de detalhe (checar antes — evita duplicar).

## Plano
| #  | Task | Cobre AC | Gate (comando) | Status |
|----|------|----------|----------------|--------|
| 1 | Checar `pcm.auvo_sync_health`/`auvo_entity_status`: colunas de detalhe já acessíveis via RLS? Se não, view/policy read-only | AC-1 | lint:migrations | todo |
| 2 | Adapter: `listarErrosSyncAuvo()` → entidades com erro (tipo, id, last_error, quando) | AC-1,AC-3 | typecheck | todo |
| 3 | UI `PcmDashboardPage`: contador de erros clicável abre lista; 0 erros = estado saudável não-clicável | AC-1,AC-2 | typecheck | todo |
| 4 | Legibilidade da mensagem (reusa `edge-function-error`); sem stack/segredo | AC-3 | vitest | todo |
| 5 | **Diagnóstico:** inspecionar os 6 erros reais em produção e documentar aqui (follow-ups de correção) | — | manual (Lucas/DB) | todo |

## Plano de teste
- Unidade: mapeamento linha→item legível; estado 0 erros.
- Aceite: Playwright — clicar no contador mostra a lista; sem erros mostra "tudo sincronizado".

## Achados (preencher ao rodar)
- Os 6 erros atuais são: _(preencher após inspecionar `pcm.auvo_entity_status`)_ →
  correção de cada um: story/fix separado se não for trivial.

## Checklist de Definition of Done
- [ ] AC verdes pelo gate
- [ ] Playwright local (Lucas)
- [ ] 6 erros atuais diagnosticados e documentados
- [ ] ROADMAP.md + STATE.md atualizados
