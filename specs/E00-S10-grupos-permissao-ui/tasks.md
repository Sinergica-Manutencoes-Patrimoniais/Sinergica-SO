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
| 1  | Extrair `ModuloId`/`MODULOS` de `HomePage.tsx` para `features/config/domain/modulo.ts` | — | E00-S09 mergeada | `pnpm --filter @sinergica/web typecheck` | done — `pnpm run typecheck` verde |
| 2  | `features/config/domain/`: `Grupo`, `PermissaoModulo`, `NivelAcesso` `[P]` | — | 1 | teste unitário | done — `modulo.test.ts` (15 casos) + `permissao.test.ts` (5 casos, `podeAcessarModulo` puro) verdes |
| 3  | `features/config/application/config-gateway.ts` (port) + casos de uso (`resolverMinhasPermissoes`, `listarGrupos`, `criarGrupo`, `editarGrupo`, `listarUsuarios`, `criarUsuario`, `definirPermissaoUsuario`, `resolverPermissoesDe`) | AC-2, AC-3 | 2 | teste unitário com fake do port | done — 8 casos de uso, cada um com `.test.ts` (fake `ConfigGateway`), 20 testes verdes no total |
| 4  | `features/config/infrastructure/supabase-config-adapter.ts` | AC-2, AC-3 | 3 | teste de integração | parcial — adapter implementado e passa `typecheck`/`build`; `supabase-config-adapter.integration.test.ts` escrito (mesmo padrão self-skip de `supabase-auth-adapter.integration.test.ts`) mas **não executado** — sem Docker/Supabase local neste ambiente. Não verificado contra banco real. |
| 5  | `PermissoesProvider` (`app/`) — chama `resolverMinhasPermissoes` ao autenticar, expõe `podeAcessar(modulo, nivel)` | AC-4 | 4 | teste unitário | done (lógica) — a resolução pura (`podeAcessarModulo`) está em `domain/permissao.ts` e testada; o Provider React em si (`app/permissoes-context.tsx`) não tem teste próprio — projeto não tem `@testing-library/react` instalado, mesma lacuna que `auth-context.tsx` já tinha |
| 6  | `HomePage.tsx`: sidebar/tab-bar filtra `MODULOS` por `podeAcessar`; botão "Configurações" ganha `onClick` e visibilidade por papel | AC-1, AC-4 | 5 | teste manual (browser) | parcial — código implementado, `typecheck`/`build`/`lint` verdes; **teste manual em browser não executado** (sem ambiente Supabase logável nesta sessão) — golden path e borda por papel ficam para validação humana |
| 7  | Componente `ModuloPermissaoGrid` (9 módulos × nenhum/leitura/escrita) reaproveitado nas 2 telas | AC-2, AC-3 | 2 | teste unitário | done (parcial) — componente puro implementado e reaproveitado por `GruposPage`/`UsuariosPage`; sem `.test.tsx` dedicado (mesma lacuna de `LoginPage.tsx`/`HomePage.tsx` — projeto não testa componentes React, só domain/application) |
| 8  | `GruposPage` — listar/criar/editar `[P]` | AC-2 | 4, 7 | teste manual (browser) | parcial — código completo (listar/criar/editar/toggle `ativo`); o gap de GRANT/RLS que bloquearia "editar permissões" foi corrigido em E00-S09 (migration `0010`, ver seção abaixo); teste manual em browser ainda pendente de validação humana |
| 9  | `UsuariosPage` — listar/criar/editar, toggle grupo↔individual sem estado inválido `[P]` | AC-3 | 4, 7 | teste manual (browser) | parcial — código implementado (`typecheck`/`build`/`lint` verdes); troca de modo sempre passa por `definirPermissaoUsuario` (nunca duas escritas separadas); **teste manual em browser não executado** |
| 10 | `docs/STATE.md` + `docs/epics/ROADMAP.md` atualizados | — | 1-9 | inspeção | done |

## Plano de teste
- Unidade: casos de uso com fake do `ConfigGateway`, `ModuloPermissaoGrid` (estado
  nenhum/leitura/escrita por módulo).
- Integração: `supabase-config-adapter` contra o schema real (mock ou Supabase local).
- Manual (browser, golden path + borda): login como cada papel, confirmar sidebar mostra só os
  módulos certos; criar grupo, atribuir a um usuário, confirmar após novo login; trocar de modo
  grupo↔individual sem quebrar.

## Divergências (SPEC_DEVIATION)
- Nenhuma — os AC foram implementados como escritos.

## Decisões de escopo (não são SPEC_DEVIATION — dentro do que o AC pede)
- **`UsuariosPage` "editar" cobre só a troca de modo grupo↔individual** (exatamente o que o AC-3
  descreve: "editar um usuário existente permite trocar de modo... via
  `config.definir_permissao_usuario`"). Editar `nome`/`papel`/`ativo` de um usuário existente
  **não foi implementado** — a lista de métodos do `ConfigGateway` fornecida para esta story não
  incluía um método de update de perfil, e adicionar um agora seria inventar escopo. RLS já
  permite esse update (`config.usuarios` update por superadmin/supervisor), então é uma extensão
  natural se o produto quiser — fica como gap conhecido, não como bug.
- **E-mail não aparece na lista de usuários.** `config.usuarios` não tem coluna `email` (só
  `auth.users` tem, e o client anon/RLS não lê `auth.users`). Lista mostra nome/papel/modo/ativo.
- **Filtro de permissão também aplicado ao grid `DashboardGeral` da tela "Início”**, além de
  sidebar/tab-bar (que é o que o AC-4 menciona literalmente). Extensão de escopo pequena e
  consistente com a intenção do AC — sem isso, um usuário sem acesso a um módulo ainda veria o
  card de KPI dele na Home.

## Bug encontrado em E00-S09 — CORRIGIDO (revisão pós-implementação, migration `0010`)
- **`supabase/migrations/0006_E00-S09_grupos_permissoes_modulo.sql` linha 77 nunca concede
  `DELETE`** em `config.grupos`/`config.grupo_modulos`/`config.usuario_modulos` para o role
  `authenticated` (`grant select, insert, update on ... to authenticated;` — falta `delete`), e
  **nenhuma migration de E00-S09 define policy de RLS para o comando DELETE** nessas 3 tabelas
  (só existem policies `_select`/`_insert`/`_update`). `config.definir_permissao_usuario` continua
  funcionando porque é `SECURITY DEFINER` e roda com o privilégio do dono da função (bypassa
  GRANT/RLS) — mas **qualquer DELETE feito pelo client via PostgREST/supabase-js falha com
  permission denied (42501)**, mesmo para superadmin/supervisor (GRANT é por role do Postgres,
  não pelo `papel` da aplicação).
- **Impacto concreto no código desta story:** `supabase-config-adapter.ts` → `editarGrupo()` faz
  `delete from grupo_modulos where grupo_id = id` antes de reinserir as novas permissões (padrão
  "substituir tudo") — **essa chamada vai falhar em produção/local** quando um
  superadmin/supervisor editar as permissões de um grupo existente pela `GruposPage`. O mesmo
  adapter também tenta um `delete` de rollback em `criarGrupo()` se o insert de `grupo_modulos`
  falhar parcialmente — também vai falhar (silenciosamente deixando o grupo órfão, sem lançar um
  segundo erro visível, porque o catch já está lançando o erro original).
- **Não afetado:** criar grupo no caminho feliz (INSERT, sem delete envolvido), toggle
  `ativo` (UPDATE), e tudo em `UsuariosPage` (passa por `definir_permissao_usuario`, que é
  SECURITY DEFINER).
- **Corrigido** em `supabase/migrations/0010_E00-S09_delete_grupos_grupo_modulos.sql`:
  `grant delete on config.grupos, config.grupo_modulos to authenticated;` + policies
  `grupos_delete`/`grupo_modulos_delete` (`superadmin`/`supervisor`), rebaseado no topo desta
  branch. `config.usuario_modulos` foi deixado de fora de propósito — nenhum fluxo desta story
  precisa de DELETE direto nela (troca de modo sempre passa por `definir_permissao_usuario`,
  `SECURITY DEFINER`). `pnpm run lint:migrations` e `node scripts/audit-esteira.mjs` verdes após
  o rebase. Teste manual em browser (editar permissões de um grupo existente) continua pendente
  de validação humana, mas o gap de GRANT/RLS que bloqueava isso está fechado.

## Checklist de Definition of Done
- [x] Todos os AC verdes **pelo gate executável** onde há runner automatizado (lint/typecheck/
      test/build — ver relatório da story). Onde o gate é "teste manual (browser)" (tasks 6, 8,
      9), **não foi executado nesta sessão** — sem ambiente Supabase logável disponível. Fica
      como validação humana pendente antes do merge.
- [x] Nenhum `SPEC_DEVIATION` pendente
- [x] Spec reflete o que foi construído
- [x] `docs/STATE.md` atualizado
