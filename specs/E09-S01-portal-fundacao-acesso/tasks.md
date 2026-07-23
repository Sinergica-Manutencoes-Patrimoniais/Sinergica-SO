---
name: tasks-E09-S01-portal-fundacao-acesso
description: Decomposição — fundação de acesso & isolamento do Portal do Cliente.
alwaysApply: false
---

# Tasks — Fundação do Portal do Cliente

> Implementação local concluída em 2026-07-21. Status por task permanece `todo` até o gate específico
> passar: pgTAP depende de Docker/CI; browser depende de backend com migrations 0142–0145 aplicado.

## Plano
| #  | Task                                                                 | Cobre AC | Depende de | Gate (comando)               | Status |
|----|----------------------------------------------------------------------|----------|------------|------------------------------|--------|
| 1  | Migration: `config.usuario_cliente` (1:1, RLS FORCE)                 | AC-1     | design     | lint + smoke SQL remoto      | done   |
| 2  | Migration: hook injeta claim `cliente_id` p/ cliente-sindico         | AC-2     | 1          | smoke SQL remoto             | done   |
| 3  | Migration: `resolver_permissoes_modulo` concede `area-cliente`       | AC-4     | 1          | smoke SQL remoto             | done   |
| 4  | Migration: RLS por-linha (`pcm.clientes` + base painel) via claim    | AC-3     | 2          | smoke SQL isolamento         | done   |
| 5  | Edge Function `config-gerenciar-usuario` estendida: cria + vincula   | AC-1,6   | 1          | Deno check + HTTP smoke      | done   |
| 6  | Botão "Criar acesso" na `VisaoClientePage` (gate superadmin/superv.) | AC-6     | 5          | browser                      | todo   |
| 7  | `PortalShell` + roteamento por papel em `App.tsx`                    | AC-5     | 3          | Playwright                   | todo   |

## Plano de teste
- Unidade: roteamento por papel (síndico→PortalShell, interno→HomePage).
- **pgTAP (crítico)**: síndico A só lê linhas de A; síndico sem `cliente_id` → 0 linhas; interno
  mantém acesso por módulo.
- Integração: provisionamento cria Auth user + vínculo atômico (rollback em falha).
- Aceite: um teste por AC; AC-3 é o gate de segurança.

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma prevista.

## Checklist de Definition of Done
- [ ] AC-1..AC-6 verdes; **pgTAP de isolamento verde no CI `db-tests`**
- [ ] `pnpm run ci:local` verde; Edge Function deployada + smoke
- [ ] ADR-0011 referenciado; senha nunca em log
- [ ] `docs/STATE.md` + ROADMAP + glossário atualizados
