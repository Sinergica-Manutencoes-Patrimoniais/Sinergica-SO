---
name: tasks
description: Decomposição e gates da UI de grupos/permissões. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Grupos e Permissões por Módulo: UI Administrativa

> Depende de `E00-S09` mergeada (schema, resolver, hook, Edge Function já existem).

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|-----------------|--------|
| 1  | Extrair `ModuloId`/`MODULOS` de `HomePage.tsx` para `features/config/domain/modulo.ts` | — | E00-S09 mergeada | `pnpm --filter @sinergica/web typecheck` | todo |
| 2  | `features/config/domain/`: `Grupo`, `PermissaoModulo`, `NivelAcesso` `[P]` | — | 1 | teste unitário | todo |
| 3  | `features/config/application/config-gateway.ts` (port) + casos de uso (`resolverMinhasPermissoes`, `listarGrupos`, `criarGrupo`, `editarGrupo`, `listarUsuarios`, `criarUsuario`, `definirPermissaoUsuario`) | AC-2, AC-3 | 2 | teste unitário com fake do port | todo |
| 4  | `features/config/infrastructure/supabase-config-adapter.ts` | AC-2, AC-3 | 3 | teste de integração | todo |
| 5  | `PermissoesProvider` (`app/`) — chama `resolverMinhasPermissoes` ao autenticar, expõe `podeAcessar(modulo, nivel)` | AC-4 | 4 | teste unitário | todo |
| 6  | `HomePage.tsx`: sidebar/tab-bar filtra `MODULOS` por `podeAcessar`; botão "Configurações" ganha `onClick` e visibilidade por papel | AC-1, AC-4 | 5 | teste manual (browser) | todo |
| 7  | Componente `ModuloPermissaoGrid` (9 módulos × nenhum/leitura/escrita) reaproveitado nas 2 telas | AC-2, AC-3 | 2 | teste unitário | todo |
| 8  | `GruposPage` — listar/criar/editar `[P]` | AC-2 | 4, 7 | teste manual (browser) | todo |
| 9  | `UsuariosPage` — listar/criar/editar, toggle grupo↔individual sem estado inválido `[P]` | AC-3 | 4, 7 | teste manual (browser) | todo |
| 10 | `docs/STATE.md` + `docs/epics/ROADMAP.md` atualizados | — | 1-9 | inspeção | todo |

## Plano de teste
- Unidade: casos de uso com fake do `ConfigGateway`, `ModuloPermissaoGrid` (estado
  nenhum/leitura/escrita por módulo).
- Integração: `supabase-config-adapter` contra o schema real (mock ou Supabase local).
- Manual (browser, golden path + borda): login como cada papel, confirmar sidebar mostra só os
  módulos certos; criar grupo, atribuir a um usuário, confirmar após novo login; trocar de modo
  grupo↔individual sem quebrar.

## Divergências (SPEC_DEVIATION)
- Nenhuma — a definir durante a implementação, se surgir.

## Checklist de Definition of Done
- [ ] Todos os AC verdes **pelo gate executável** (ou teste manual documentado, onde não há
      runner de UI automatizado)
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] Spec reflete o que foi construído
- [ ] `docs/STATE.md` atualizado
