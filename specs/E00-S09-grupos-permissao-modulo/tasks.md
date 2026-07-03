---
name: tasks
description: Decomposição e gates de Grupos e permissões por módulo (fundação). Puxe ao implementar.
alwaysApply: false
---

# Tasks — Grupos e Permissões por Módulo: Fundação

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|-----------------|--------|
| 1  | Migration `0006`: `config.grupos`/`grupo_modulos`/`usuario_modulos`, `usuarios.grupo_id` (FK `NOT VALID`), RLS+GRANT das 3 tabelas novas (superadmin+supervisor), RLS de `config.usuarios` ajustada (supervisor + anti-escalação), triggers de exclusividade mútua | AC-1, AC-2, AC-10 | E00-S08 mergeada | `pnpm run lint:migrations` | done |
| 2  | Squawk local acusou a FK de `grupo_id` sem `NOT VALID` (confirmado); migration `0007` com `validate constraint` separada | — | 1 | `pnpm run lint:migrations` | done |
| 3  | Migration `0008`: `config.resolver_permissoes_modulo` (com guarda de auto-escopo), `config.minhas_permissoes` (view), `config.definir_permissao_usuario` (troca atômica) | AC-3, AC-4, AC-6 | 1 | `pnpm run lint:migrations` ok; **revisão encontrou bug de segurança real** — guarda de auto-escopo usava `current_user` (sempre o dono da função em `SECURITY DEFINER`, nunca quem chamou) em vez de `session_user`, tornando a checagem um no-op para as duas funções. Corrigido. `supabase test db` (Docker indisponível localmente) fica pendente do CI — ver task 6 | done (corrigido) — aguardando `db-tests` no CI |
| 4  | Migration `0008`: reescrever `config.custom_access_token_hook` para emitir `user_modulos` | AC-5, AC-9 | 3 | login/refresh real, decodificar JWT | done — validação de ponta a ponta (login real) ainda pendente pós-merge |
| 5  | Migration `0009`: `alter policy` nas 6 tabelas de domínio (módulo) + `config.feature_flags` (superadmin-only) | AC-7, AC-8 | 4 | `pnpm run lint:migrations` (limpo, 9 migrations) | done |
| 6  | pgTAP: cobrir AC-1 a AC-11 em `supabase/tests/e00-s05_rbac.test.sql` | AC-1 a AC-11 | 1-5 | `supabase test db` (CI, job `db-tests`) | escrito (28 asserções) — **`plan(34)` estava incorreto (só 28 testes existem), corrigido para `plan(28)`**; nunca tinha sido executado de fato (sem Docker local nesta revisão) — job `db-tests` do CI é o gate real, checar antes do merge |
| 7  | Edge Function `supabase/functions/config-gerenciar-usuario/` — cria Auth user + `provisionar_usuario` + `definir_permissao_usuario`, valida papel do chamador | AC-11 | 3, 4 | teste manual via `curl`/`supabase functions serve` | escrito, segue o padrão de `_template/index.ts` corretamente — teste manual ponta a ponta pendente pós-merge |
| 8  | `grant execute on function config.provisionar_usuario(...) to service_role` (resolve a dúvida de grant que ficava em aberto desde `0002`) | AC-11 | 7 | incluso na migration `0008`, `pnpm run lint:migrations` ok | done |
| 9  | `db/rls.template.sql` — adicionar seção de exemplo do padrão módulo `[P]` | — | 5 | inspeção | done |
| 10 | `docs/glossary.md` — adicionar "Módulo", "Grupo", "Permissão individual", "Nível de acesso" `[P]` | — | — | `audit:esteira` | done |
| 11 | `runbooks/provisionar-usuario.md` — UI/Edge Function como caminho principal, SQL Editor como fallback `[P]` | — | 7 | inspeção | done |
| 12 | `docs/adr/0004-permissoes-por-modulo-grupos.md` — ADR novo, estende `0003` | — | 1-5 | inspeção | done |
| 13 | `docs/epics/ROADMAP.md` + `docs/STATE.md` atualizados | — | 1-12 | inspeção | done |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual (exceto onde
> marcado "inspeção").

## Plano de teste
- `pnpm run lint:migrations` limpo em cada migration (GRANT-por-policy + Squawk).
- pgTAP (`supabase test db`, CI job `db-tests`): cobertura de todos os AC-1 a AC-10 — criação de
  grupo por papel certo/errado, trigger de exclusividade nos dois sentidos, resolver nos dois
  modos + vazio, hook emitindo claim fiel, `minhas_permissoes` escopado, RLS de domínio por
  módulo×nível×papel incluindo superadmin sempre passando, `feature_flags` negando supervisor,
  usuário inativo sem permissão, supervisor barrado de promover a superadmin.
- Teste manual: Edge Function ponta a ponta (criar usuário, confirmar login e claim `user_modulos`
  corretos no JWT).

## Divergências (SPEC_DEVIATION)
- Nenhuma no contrato da spec — mas registrando aqui um achado real de revisão: a primeira versão
  implementada de `config.resolver_permissoes_modulo` e `config.definir_permissao_usuario` usava
  `current_user` para reconhecer chamadas internas (hook/service_role), o que é sempre o **dono**
  da função dentro de um `SECURITY DEFINER` (não quem chamou) — a guarda de autorização nunca
  disparava, tornando as duas funções chamáveis por qualquer `authenticated` sem restrição real
  (leitura de permissão de qualquer usuário + reatribuição de grupo/permissão de qualquer
  usuário). Corrigido para `session_user` (não muda dentro de `SECURITY DEFINER`) antes do merge.
  O pgTAP já tinha a asserção que provaria isso (`throws_ok` esperando `42501`), mas nunca tinha
  sido executado (`supabase test db` exige Docker, indisponível nesta revisão) — reforça que
  `db-tests` no CI é o gate real, não a leitura do código.

## Checklist de Definition of Done
- [ ] Todos os AC verdes **pelo gate executável**
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] `docs/adr/0004-permissoes-por-modulo-grupos.md` criado (não editou o `0003`)
- [ ] Glossário atualizado (Módulo, Grupo, Permissão individual, Nível de acesso)
- [ ] Spec reflete o que foi construído
- [ ] `docs/STATE.md` e `docs/epics/ROADMAP.md` atualizados
- [ ] Segredos: nenhum novo necessário (Edge Function usa `service_role` injetada pelo runtime)
