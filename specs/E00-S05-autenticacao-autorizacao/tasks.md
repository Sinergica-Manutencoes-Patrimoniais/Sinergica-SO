---
name: tasks
description: Decomposição e gates da story E00-S05 — Autenticação e Autorização (Supabase Auth + RBAC).
alwaysApply: false
---

# Tasks — E00-S05: Autenticação e Autorização

> Decomposição de `spec.md` (9 AC) + `design.md` (ADR-0003). Uma task só vira `done` quando o
> **gate passa** — não por inspeção visual. Um commit por task (local, `@dev` não faz push).

## Plano

| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|---|---|---|---|---|
| 1 | Migration `0002_E00-S05_perfis_rbac.sql` — tabela `config.usuarios` (papel `not null` + `check` nos 4 valores, FK `auth.users` `on delete cascade`, colunas de auditoria, RLS FORCE) `[P]` | AC-3, AC-4 | — | `supabase db reset && psql -c "\d config.usuarios"` mostra a tabela com constraint `check` visível | todo |
| 2 | Mesma migration — função `config.provisionar_usuario(p_user_id uuid, p_papel text, p_nome text)` (insere validando papel contra o `check`) `[P]` | AC-4 | 1 | `psql -c "select config.provisionar_usuario('<uuid-teste>','papel_invalido','x')"` retorna erro de `check violation`; com papel válido retorna sucesso | todo |
| 3 | Mesma migration — função `config.custom_access_token_hook(event jsonb)` + `grant execute ... to supabase_auth_admin` + `revoke ... from authenticated, anon, public` | AC-3, AC-9 | 1 | `psql -c "select has_function_privilege('supabase_auth_admin','config.custom_access_token_hook(jsonb)','execute')"` retorna `t`; mesmo teste para `authenticated` retorna `f` | todo |
| 4 | Mesma migration — RLS policies nas 7 tabelas da matriz de decisão (`pcm.clientes`, `pcm.ordens_servico`, `atendimento.config_ze`, `atendimento.wa_messages`, `atendimento.wa_queue`, `comercial.leads`, `config.feature_flags`), padrão `auth.jwt() ->> 'user_role' in (...)` | AC-8, AC-9 | 1, 3 | `select tablename, policyname, cmd from pg_policies where schemaname in ('pcm','atendimento','comercial','config')` lista pelo menos 1 policy de select por tabela — nenhuma das 7 aparece sem policy | todo |
| 5 | Registrar o Custom Access Token Hook em `supabase/config.toml` (ambiente local) e documentar o passo equivalente de produção (Dashboard → Authentication → Hooks) em comentário na migration — validar sintaxe exata contra a doc oficial do Supabase (questão em aberto do `design.md`) | AC-3 | 3 | `supabase start` sobe sem erro de config; login de teste local (task 12) retorna JWT decodificado com claim `user_role` presente | todo |
| 6 | pgTAP `supabase/tests/e00-s05_rbac.test.sql` — matriz completa (4 papéis + "sem `user_role`") × 7 tabelas, seguindo `db/rls-test.md` | AC-8, AC-9 | 4, 5 | `supabase test db` — suíte verde, cada combinação papel×tabela com `throws_ok`/`lives_ok` conforme a matriz do `spec.md` | todo |
| 7 | `runbooks/provisionar-usuario.md` — fluxo de 2 passos (criar em Auth → Dashboard/`admin.createUser()`; rodar `config.provisionar_usuario`) | AC-4 | 2 | revisão manual (`@qa`) confirma que o runbook, seguido à risca num ambiente local limpo, resulta em usuário capaz de logar com papel correto | todo |
| 8 | `apps/web/src/lib/supabase-client.ts` — client único `createClient()` usando `config/env.ts` (`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`) `[P]` | AC-1 | — | `pnpm run typecheck` verde no arquivo; import único reusado (sem segunda instância de `createClient` no repo — `grep -r "createClient(" apps/web/src` retorna 1 ocorrência) | todo |
| 9 | `apps/web/src/features/auth/domain/role.ts` — type `Role` + guards puros (`isValidRole`, etc.) `[P]` | AC-3 | — | teste unitário (`pnpm --filter web test role.test.ts`) verde | todo |
| 10 | `apps/web/src/features/auth/application/{sign-in,sign-out,get-session}.ts` — casos de uso (trata "sem `user_role`" bloqueando com mensagem clara) | AC-1, AC-2, AC-4, AC-5, AC-6 | 8, 9 | teste unitário com adapter mockado (`pnpm --filter web test features/auth/application`) verde, incluindo caso "sessão sem `user_role`" | todo |
| 11 | `apps/web/src/features/auth/infrastructure/supabase-auth-adapter.ts` — implementa a porta usando `@supabase/supabase-js` (`signInWithPassword`, `signOut`, `onAuthStateChange`) | AC-1, AC-5, AC-6 | 8, 10 | teste de integração contra Supabase local (`supabase start` + `pnpm --filter web test:integration auth`) verde | todo |
| 12 | Refatorar `apps/web/src/app/auth-context.tsx` — remove bypass `DEV-ONLY`/`localStorage` manual, delega para `features/auth/application`, expõe estado de loading da sessão | AC-1, AC-6, AC-7 | 10, 11 | `grep -rn "DEV-ONLY\|Trivia123456" apps/web/src` sem resultados; `pnpm run typecheck` verde | todo |
| 13 | Guard de rota (`apps/web/src/app/`) — redireciona para `/login` sem sessão válida, sem "flash" de conteúdo protegido durante o loading | AC-7 | 12 | teste de aceite manual/E2E: acessar rota interna sem sessão → redirect antes de qualquer render de tela protegida | todo |
| 14 | Ajustar `LoginPage.tsx` — mensagem genérica de erro (AC-2) e mensagem "Conta sem perfil configurado — contate o administrador." (caso de borda AC-4) | AC-2, AC-4 | 12 | teste de aceite manual: login com credencial inválida → mensagem genérica; login com usuário sem `config.usuarios` → mensagem específica de perfil ausente, sessão encerrada | todo |
| 15 | Gates finais de qualidade do projeto | AC-1 a AC-9 | 6, 13, 14 | `pnpm run typecheck && pnpm exec biome check apps/web/src/ && supabase test db` — tudo verde | todo |

## Plano de teste

- **Unidade:** `features/auth/domain/role.ts` (guards de papel — valores válidos/inválidos);
  `features/auth/application/*` com adapter de auth mockado (fluxo de sign-in feliz, credencial
  inválida, sessão sem `user_role`, sign-out).
- **Integração:** `supabase-auth-adapter.ts` contra Supabase local (`supabase start`) — prova que
  o SDK real devolve sessão com o claim esperado após login.
- **RLS (pgTAP):** `supabase/tests/e00-s05_rbac.test.sql` — é o **gate de aceite** de AC-8 e AC-9;
  cobre os 4 papéis + "sem papel" contra as 7 tabelas da matriz de decisão do `spec.md`, incluindo
  o caso de escrita negada para `tecnico`/`cliente-sindico` e leitura negada para quem não tem
  `user_role` algum.
- **Aceite (manual/E2E):** login válido → dashboard (AC-1); login inválido → mensagem genérica
  (AC-2); reload de página mantém sessão (AC-5); logout → redirect + sessão limpa (AC-6); acesso
  direto a rota interna sem sessão → redirect antes de qualquer render (AC-7); usuário sem perfil
  → bloqueio explícito (AC-4).

## Divergências (SPEC_DEVIATION)
> Se a implementação precisar fugir da spec, registre aqui antes de seguir (ver `CLAUDE.md`).
- [ ] Nenhuma no momento da criação deste plano. `@dev` deve preencher se a sintaxe real do
  Custom Access Token Hook (task 5) divergir do desenhado em `design.md`.

## Checklist de Definition of Done
- [ ] Todos os AC (AC-1 a AC-9) verdes **pelo gate executável** de cada task
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] ADR-0003 confirmado sem alteração de decisão (ou substituído formalmente, se `@dev` achar
  necessário divergir)
- [ ] Glossário (`docs/glossary.md`) atualizado se "papel"/"perfil" precisar de entrada formal
- [ ] `spec.md` reflete o que foi construído (sem policies "fantasma" fora da matriz documentada)
- [ ] `docs/STATE.md` e `docs/epics/ROADMAP.md` atualizados (AC verdes, status "Implementado")
- [ ] Nenhuma credencial/bypass de dev (`Trivia123456`, `DEV-ONLY`) restante no código
- [ ] `runbooks/provisionar-usuario.md` testado manualmente por `@qa` antes do merge
