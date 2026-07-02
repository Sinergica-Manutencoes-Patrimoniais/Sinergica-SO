---
name: design
description: Technical Design Doc — E00-S05 Autenticação e Autorização (Supabase Auth + RBAC via JWT claim).
alwaysApply: false
---

# Technical Design Doc — E00-S05: Autenticação e Autorização

> **Tier:** arquitetural · **Status:** aprovado
> **Autor:** @architect (Aria) · **Revisores:** @pm, @dev, @qa · **Data:** 2026-07-01
> Relacionado: [`product.md`](./product.md) · [`spec.md`](./spec.md) · [ADR-0003](../../docs/adr/0003-rbac-jwt-claim-config-usuarios.md)

## Contexto da funcionalidade

Hoje o login é um bypass de dev (`apps/web/src/app/auth-context.tsx`) com credencial hardcoded e
papel salvo em `localStorage`. As 7 tabelas de domínio já existentes (`pcm.clientes`,
`pcm.ordens_servico`, `atendimento.*`, `comercial.leads`, `config.feature_flags`) têm `RLS FORCE`
habilitado desde a migration `0001_E00-S00`, mas **sem nenhuma policy de acesso** — ou seja, hoje
estão de fato inacessíveis a qualquer client autenticado real (deny by default, correto, mas
incompleto: falta a policy que *libera* o acesso certo por papel).

Esta story constrói a camada de identidade que todas as próximas stories de domínio vão reusar:
quem é o usuário (Supabase Auth) e qual seu papel (fonte de verdade no Postgres), disponível de
forma performática dentro das RLS policies.

## Goals / Non-goals

**Goals**
- Login/logout real via Supabase Auth, sessão gerenciada pelo SDK.
- Papel do usuário como fonte de verdade no Postgres, resolvido nas RLS policies **sem** query
  adicional a cada linha avaliada (ver Design proposto).
- Padrão de RLS por papel documentado e aplicado às 7 tabelas já existentes.
- Guard de rota no frontend.

**Non-goals**
- Ver `product.md` → Non-goals (SSO, MFA, UI de reset de senha, telas de admin de usuário,
  auth do cliente-síndico, policies granulares de "dono do registro").

## Design proposto

### Visão geral do fluxo

```
1. Usuário submete e-mail/senha no LoginPage
2. supabase.auth.signInWithPassword() → Supabase Auth valida e MINTA um JWT
3. Antes de assinar o JWT, o Custom Access Token Hook (função Postgres) roda:
   → lê config.usuarios (papel do usuário) pelo user_id
   → injeta claim "user_role" no JWT (ou omite/null se não houver perfil)
4. Frontend recebe a sessão (JWT já com user_role embutido) — SDK do Supabase gerencia
   storage + refresh automaticamente (localStorage interno do SDK, não mais manual)
5. App verifica se a sessão tem user_role válido:
   → se sim: libera rotas internas, guarda o papel em memória (contexto React) para UI
   → se não: bloqueia com "Conta sem perfil configurado", força signOut()
6. Toda query ao Postgres (via supabase-js, RLS ativo) é avaliada contra
   auth.jwt() ->> 'user_role' — SEM subquery a config.usuarios em tempo de request
```

```mermaid
sequenceDiagram
  participant U as Usuário
  participant FE as Frontend (React)
  participant Auth as Supabase Auth
  participant Hook as custom_access_token_hook (Postgres)
  participant DB as Postgres (config.usuarios)
  participant RLS as RLS policies (pcm.*, comercial.*, ...)

  U->>FE: e-mail + senha
  FE->>Auth: signInWithPassword()
  Auth->>Hook: antes de assinar o JWT
  Hook->>DB: select role from config.usuarios where user_id = ...
  DB-->>Hook: role | (nenhuma linha)
  Hook-->>Auth: claims + user_role (ou omitido)
  Auth-->>FE: sessão (JWT com user_role)
  FE->>FE: valida user_role presente; se ausente, signOut + mensagem
  FE->>RLS: queries subsequentes (Postgres avalia auth.jwt()->>'user_role' direto do token)
```

### Por que JWT claim e não subquery em tempo de policy

A alternativa óbvia seria cada RLS policy fazer
`using (exists (select 1 from config.usuarios where user_id = auth.uid() and role = 'admin'))`.
Rejeitada por dois motivos:
1. **Recursão/custo:** toda linha avaliada em toda tabela dispara uma subquery a `config.usuarios`
   — N tabelas × M linhas × 1 subquery cada. Não escala e complica combinar com `security
   definer` corretamente sem abrir brecha.
2. **Inconsistência com o padrão já estabelecido no projeto:** `db/rls.template.sql` e
   `db/README.md` (perfil single-repo) já definem o padrão `auth.jwt() ->> 'user_role'` lido
   direto do token. Manter os dois perfis (single-repo e OS) consistentes evita que o `@dev` de
   uma feature futura precise aprender dois mecanismos diferentes de RLS.

O Custom Access Token Hook do Supabase Auth resolve o papel **uma vez por emissão/refresh de
token** (não por request de dado), e o restante do sistema só lê o claim já resolvido.

### Onde vive o papel — `config.usuarios`

`docs/ARCHITECTURE.md` já documenta o schema `config` como "Configurações de sistema (Zé,
integrações, **papéis**)" — decisão já implícita na arquitetura viva, esta story só a
materializa. Não se cria schema novo (`identidade`/`auth_app`): não há fronteira de domínio nova,
é dado de governança transversal, mesma categoria de `config.feature_flags`.

```sql
-- Alto nível — DDL real é do @dev na migration 0002_E00-S05_perfis_rbac.sql
create table config.usuarios (
  user_id      uuid        primary key references auth.users(id) on delete cascade,
  papel        text        not null check (papel in ('admin','escritorio','tecnico','cliente-sindico')),
  nome         text        not null,
  ativo        boolean     not null default true,
  created_at   timestamptz not null default now(),
  created_by   uuid        references auth.users,
  updated_at   timestamptz,
  updated_by   uuid        references auth.users
);
alter table config.usuarios enable row level security;
alter table config.usuarios force row level security;
-- policy: usuário lê o próprio registro; admin lê/escreve todos (ver Cobertura dos 5 eixos → Qualidade)
```

`papel not null` garante, a nível de banco, que **nenhuma linha em `config.usuarios` existe sem
papel válido** (AC-4, primeira parte). A segunda parte do AC-4 — usuário do `auth.users` sem
NENHUMA linha em `config.usuarios` — é o estado "perfil ausente", tratado explicitamente (ver
próxima seção), nunca um "papel null" dentro da tabela.

### Provisionamento de usuário (sem trigger automático "cego")

Rejeitado: trigger `after insert on auth.users` que cria a linha em `config.usuarios`
automaticamente. Motivo: não há como o trigger *adivinhar* o papel correto do novo usuário —
inserir com um papel padrão (ex.: `tecnico`) seria uma decisão de segurança silenciosa (privilégio
implícito), e inserir com `papel null` violaria a constraint `not null` que é a garantia do AC-4.

Decisão: provisionamento é **explícito, em duas etapas documentadas** (consistente com o Non-goal
"sem UI de administração de usuário" — mantém o fluxo 100% SQL/Dashboard nesta fase):
1. Admin cria o usuário no Supabase Dashboard (Authentication → Users → Add user) ou via
   `supabase.auth.admin.createUser()` em script.
2. Admin roda a função `config.provisionar_usuario(p_user_id uuid, p_papel text, p_nome text)`
   (criada nesta migration) que insere em `config.usuarios` — a função valida o papel contra o
   `check` constraint (erro claro se inválido) e é a **única** via documentada de criar o vínculo.

Isso é documentado em `runbooks/provisionar-usuario.md` (novo, criado nesta story) como o
procedimento operacional — não é uma tela, é um runbook para o admin/devops.

### Custom Access Token Hook

```sql
-- Registrado como Auth Hook no Supabase (Dashboard → Authentication → Hooks,
-- ou supabase/config.toml em ambiente local) — não é aplicado por migration comum,
-- é configuração de projeto. @dev deve validar o passo exato contra a doc oficial do
-- Supabase no momento da implementação (mecanismo pode ter nuances de versão).
create or replace function config.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_papel text;
  v_claims jsonb;
begin
  select papel into v_papel
    from config.usuarios
   where user_id = (event->>'user_id')::uuid
     and ativo = true;

  v_claims := coalesce(event->'claims', '{}'::jsonb);
  v_claims := jsonb_set(v_claims, '{user_role}', to_jsonb(v_papel)); -- null vira JSON null se não achou
  event := jsonb_set(event, '{claims}', v_claims);
  return event;
end;
$$;

grant execute on function config.custom_access_token_hook to supabase_auth_admin;
revoke execute on function config.custom_access_token_hook from authenticated, anon, public;
```

Com isso, toda policy nas tabelas de domínio segue **o mesmo padrão do `db/rls.template.sql`**:

```sql
create policy "clientes_select" on pcm.clientes
  for select to authenticated
  using (auth.jwt() ->> 'user_role' in ('admin','escritorio','tecnico'));
```

### Frontend — estrutura da feature `auth`

```
apps/web/src/features/auth/
  domain/
    role.ts              -- type Role = 'admin'|'escritorio'|'tecnico'|'cliente-sindico'; guards puros
  application/
    sign-in.ts            -- caso de uso: valida input, chama porta de auth, trata "sem papel"
    sign-out.ts
    get-session.ts
  infrastructure/
    supabase-auth-adapter.ts  -- implementa a porta usando @supabase/supabase-js
  pages/
    LoginPage.tsx          -- já existe, passa a chamar application/sign-in via useAuth()
apps/web/src/app/
  auth-context.tsx         -- PERMANECE aqui: é estado transversal (guard de rota, shell,
                            -- todas as features leem o papel) — não pertence a um bounded
                            -- context de negócio. Passa a delegar a lógica real para
                            -- features/auth/application (sem reimplementar signIn/signOut).
apps/web/src/lib/
  supabase-client.ts       -- NOVO: client único do @supabase/supabase-js (createClient),
                            -- usa apps/web/src/config/env.ts (VITE_SUPABASE_URL/ANON_KEY).
                            -- Compartilhado por toda a app — vive em lib/, não em uma feature.
```

`auth-context.tsx` continua em `app/` (não migra para dentro de `features/auth/`) porque é
consumido pelo shell/roteamento de toda a aplicação (guard de rota é uma preocupação
cross-feature) — migrá-lo para dentro de uma feature violaria a regra "features de domínios
diferentes não se importam" no sentido inverso (todas dependeriam de `features/auth`). Ele passa a
ser uma casca fina que delega para os casos de uso de `features/auth/application`.

## Cobertura dos 5 eixos

### 1. Tech stack
`@supabase/supabase-js` (já é dependência transitiva do projeto Supabase, formalizar em
`apps/web/package.json` se ainda não explícito). Nenhuma lib nova de auth (sem NextAuth/Clerk/etc.
— Supabase Auth já é a escolha de stack do projeto). PostgreSQL Custom Access Token Hook é recurso
nativo do Supabase Auth (Postgres Hooks), sem serviço externo adicional.

### 2. Arquitetura base
Nova fronteira? Não — `config` já é schema transversal de governança. Novo agregado no domínio
`auth` do frontend (Role, Session). Camadas DDD aplicadas dentro de `features/auth/` conforme
seção anterior.

### 3. Infra
Recurso novo: 1 função Postgres (`config.custom_access_token_hook`) + 1 tabela
(`config.usuarios`) + 1 função de provisionamento (`config.provisionar_usuario`) — tudo na
migration `0002_E00-S05_perfis_rbac.sql`. Configuração de projeto Supabase (não código):
registrar o Auth Hook (Dashboard/`config.toml`). Reversão seguraz: policies e função são
idempotentes (`create or replace`); a tabela `config.usuarios` reverte com `drop table` documentado
no topo da migration (ver `db/README.md` — reverso obrigatório).

### 4. Qualidade
- **Unidade (frontend):** `features/auth/domain/role.ts` (guards de papel), `application/*`
  (casos de uso com adapter mockado).
- **Integração:** `supabase-auth-adapter.ts` contra Supabase local (`supabase start`), cobrindo
  AC-1, AC-2, AC-5, AC-6.
- **RLS (pgTAP, `db/rls-test.md`):** `supabase/tests/e00-s05_rbac.test.sql` — para cada uma das 7
  tabelas da matriz de decisão do `spec.md`, testar os 4 papéis + o caso "sem `user_role`" (AC-8,
  AC-9). É o **gate de aceite** destes dois AC — não por inspeção.
- **Aceite (E2E manual ou Playwright):** login válido → dashboard; login inválido → mensagem
  genérica; rota interna sem sessão → redirect; logout → redirect + sessão limpa (AC-1, 2, 6, 7).
- **Performance:** claim já vem no JWT — zero query adicional por request de dado (é a própria
  justificativa da escolha, ver "Design proposto").

### 5. Observabilidade
- Log estruturado (`apps/web/src/lib/log.ts`) em falhas de login e em bloqueio por "sem perfil" —
  **nunca** logar senha ou o JWT completo (mesma regra do AC de segurança do E00-S03).
  Auditoria de acesso a domínio, não desta story (fica para quando as próprias features gravarem
  `audit.events` em suas escritas).

## Mapa de dependências

| Dependência | Tipo | Descrição | Métodos / endpoints |
|---|---|---|---|
| Supabase Auth | Serviço gerenciado | Autenticação e emissão de JWT | `signInWithPassword`, `signOut`, `onAuthStateChange` |
| Supabase Auth Hooks | Configuração de projeto | Injeta `user_role` no JWT | Custom Access Token Hook (Postgres function) |
| `config.usuarios` | Tabela própria | Fonte de verdade do papel | `select`/`insert` via `provisionar_usuario` |

## Alternativas consideradas

| Alternativa | Prós | Contras | Por que (não) escolhida |
|---|---|---|---|
| **JWT claim via Custom Access Token Hook + `config.usuarios`** (A) | Zero custo por request; consistente com padrão single-repo já documentado; papel não pode ser forjado pelo client | Requer configurar o Auth Hook no projeto Supabase (passo de config, não só SQL); papel só atualiza no próximo refresh de token (latência de revogação) | **Escolhida** |
| Subquery a `config.usuarios` dentro de cada policy | Papel sempre atualizado na hora | Custo por linha/tabela; risco de recursão de RLS se mal escrito; diverge do padrão já estabelecido em `db/rls.template.sql` | Rejeitada |
| Papel salvo em `raw_app_meta_data` do próprio `auth.users` (sem tabela) | Sem tabela nova; simples | Sem FK/constraint de integridade; sem histórico (`created_by`/`updated_at`); mistura dado de identidade com dado de aplicação dentro do próprio `auth.users` (schema gerido pelo Supabase) | Rejeitada — projeto exige colunas de auditoria em toda tabela de domínio; papel é dado da aplicação, não da autenticação |
| Trigger automático cria `config.usuarios` ao inserir em `auth.users` | Zero passo manual | Não há como inferir o papel correto; obriga papel default (risco de privilégio implícito) ou papel null (viola `not null`) | Rejeitada — ver seção "Provisionamento de usuário" |

## Trade-offs e consequências

- **Aceito:** mudança de papel de um usuário só reflete depois do refresh do token (Supabase
  renova por padrão a cada ~1h, ou no próximo login). Não é revogação instantânea. Aceitável para
  o volume/risco desta fase (equipe pequena, sem caso de uso de "revogar agora").
- **Aceito:** provisionamento de usuário é manual/SQL (2 passos: criar no Dashboard +
  `provisionar_usuario`). Dívida documentada para quando houver demanda de self-service
  (onboarding de técnico em volume) — não bloqueia este tier.
- **Ganho:** todas as próximas stories de domínio (PCM, Comercial, Financeiro…) reusam o mesmo
  padrão de policy (`auth.jwt() ->> 'user_role' in (...)`) sem redecidir arquitetura de RLS.

## Riscos

| Risco | Descrição | Prob. × Impacto | Ações / mitigações |
|---|---|---|---|
| Auth Hook mal configurado no projeto Supabase | Se o hook não for registrado corretamente, `user_role` nunca aparece no JWT → todo mundo fica bloqueado (fail-closed, não fail-open — comportamento seguro, mas indisponibilidade) | baixa × alto | `@dev` valida com um teste manual de login antes de considerar a task feita; `@qa` inclui isso no gate |
| Dessincronia entre `auth.users` e `config.usuarios` (usuário deletado no Auth mas não no perfil) | `on delete cascade` na FK trata o caso órfão | baixa × baixo | FK já cobre |
| Mudança de papel não refletir imediatamente | Admin muda papel, usuário continua com token antigo até refresh | média × médio | Documentar no runbook: "para revogar com urgência, revogar a sessão via Supabase Dashboard (invalidate refresh token)" |

## Roadmap da feature

| Fase / onda | Entrega | Quando | Depende de |
|---|---|---|---|
| 1 (esta story) | Login/logout real, `config.usuarios`, hook, policies nas 7 tabelas existentes, guard de rota | E00-S05 | — |
| 2 | Policies granulares "dono do registro" (ex.: técnico só vê a própria OS) | Story de cada domínio (ex.: E01-S07) | Fase 1 |
| 3 | Autenticação do cliente-síndico (portal/WhatsApp) | E09 — Área do Cliente | Fase 1 |

## Questões em aberto

- [ ] Confirmar no momento da implementação a sintaxe exata de registro do Custom Access Token
  Hook na versão atual do Supabase (Dashboard vs. `supabase/config.toml` local) — `@dev`, antes de
  fechar a task do hook.
- [ ] Definir se `config.usuarios.nome` é obrigatório nesta story ou pode vir de
  `auth.users.raw_user_meta_data` — decisão de implementação, não bloqueia o design.

> Decisão difícil de reverter registrada em [ADR-0003](../../docs/adr/0003-rbac-jwt-claim-config-usuarios.md).
