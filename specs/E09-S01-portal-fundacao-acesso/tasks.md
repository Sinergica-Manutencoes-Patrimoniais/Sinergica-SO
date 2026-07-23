---
name: tasks-E09-S01-portal-fundacao-acesso
description: Decomposição — fundação de acesso & isolamento do Portal do Cliente.
alwaysApply: false
---

# Tasks — Fundação do Portal do Cliente

> Implementação e gates concluídos. Em 2026-07-22, pgTAP rodou numa stack criada do zero e o
> portal/build passou junto da suíte de browser; o UAT hospedado pertence à E09-S11.

## Plano
| #  | Task                                                                 | Cobre AC | Depende de | Gate (comando)               | Status |
|----|----------------------------------------------------------------------|----------|------------|------------------------------|--------|
| 1  | Migration: `config.usuario_cliente` (1:1, RLS FORCE)                 | AC-1     | design     | lint + smoke SQL remoto      | done   |
| 2  | Migration: hook injeta claim `cliente_id` p/ cliente-sindico         | AC-2     | 1          | smoke SQL remoto             | done   |
| 3  | Migration: `resolver_permissoes_modulo` concede `area-cliente`       | AC-4     | 1          | smoke SQL remoto             | done   |
| 4  | Migration: RLS por-linha (`pcm.clientes` + base painel) via claim    | AC-3     | 2          | smoke SQL isolamento         | done   |
| 5  | Edge Function `config-gerenciar-usuario` estendida: cria + vincula   | AC-1,6   | 1          | Deno check + HTTP smoke      | done   |
| 6  | Botão "Criar acesso" na `VisaoClientePage` (gate superadmin/superv.) | AC-6     | 5          | browser                      | done   |
| 7  | `PortalShell` + roteamento por papel em `App.tsx`                    | AC-5     | 3          | Playwright                   | done   |

## Plano de teste
- Unidade: roteamento por papel (síndico→PortalShell, interno→HomePage).
- **pgTAP (crítico)**: síndico A só lê linhas de A; síndico sem `cliente_id` → 0 linhas; interno
  mantém acesso por módulo.
- Integração: provisionamento cria Auth user + vínculo atômico (rollback em falha).
- Aceite: um teste por AC; AC-3 é o gate de segurança.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma prevista.

## Checklist de Definition of Done
- [x] AC-1..AC-6 verdes; **pgTAP de isolamento verde no CI `db-tests`**
- [x] `pnpm run ci:local` verde; Edge Function deployada + smoke
- [x] ADR-0011 referenciado; senha nunca em log
- [x] `docs/STATE.md` + ROADMAP + glossário atualizados
