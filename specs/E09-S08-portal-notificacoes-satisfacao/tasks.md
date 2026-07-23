---
name: tasks-E09-S08-portal-notificacoes-satisfacao
description: Decomposição — notificações + satisfação no portal.
alwaysApply: false
---

# Tasks — Notificações + satisfação

> Implementação local concluída em 2026-07-21; envio real/pgTAP/browser aguardam ambiente integrado.

## Plano
| #  | Task                                                        | Cobre AC | Depende de | Gate (comando)               | Status |
|----|-------------------------------------------------------------|----------|------------|------------------------------|--------|
| 1  | Migration: notificações por `cliente_id` (RLS) + satisfação | AC-1,2,3 | E09-S01    | lint + smoke SQL remoto      | done   |
| 2  | Geração de notificação a partir dos eventos-fonte           | AC-1     | 1          | `pnpm test`                  | done   |
| 3  | Central de notificações na PortalShell (lida/não-lida)      | AC-2     | 1          | browser                      | done   |
| 4  | Pesquisa CSAT/NPS pós-OS (registro, não repetir)            | AC-3,4   | 1          | `pnpm test`+browser          | done   |
| 5  | E-mail opcional via E00-S12 (degrada sem provedor)          | AC-1     | 2          | Deno check + HTTP smoke      | done   |

## Plano de teste
- pgTAP: notificação/satisfação isoladas por `cliente_id`.
- Unidade: não repetir pesquisa da mesma OS; e-mail ausente não finge sucesso.
- Aceite: um teste por AC.

## Checklist de Definition of Done
- [x] AC-1..AC-4 verdes; pgTAP de isolamento
- [x] `pnpm run ci:local` verde
- [x] Liga a E01-S55 (satisfação) sem duplicar
- [x] `docs/STATE.md` + ROADMAP atualizados
