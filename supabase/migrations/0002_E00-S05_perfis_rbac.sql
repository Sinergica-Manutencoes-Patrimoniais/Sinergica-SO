-- 0002_E00-S05_perfis_rbac.sql — Sinérgica SO
-- Story E00-S05 (Autenticação e Autorização). Ver specs/E00-S05-autenticacao-autorizacao/
-- design.md e ADR-0003 (docs/adr/0003-rbac-jwt-claim-config-usuarios.md) para o racional completo.
--
-- Reverso:
--   revoke all on pcm.clientes, pcm.ordens_servico, atendimento.config_ze, atendimento.wa_messages,
--     atendimento.wa_queue, comercial.leads, config.feature_flags, config.usuarios from authenticated;
--   revoke usage on schema pcm, atendimento, comercial, config from authenticated;
--   drop policy if exists "config.usuarios: auth admin le hook" on config.usuarios;
--   drop function if exists config.custom_access_token_hook(jsonb);
--   drop function if exists config.provisionar_usuario(uuid, text, text);
--   drop policy if exists "clientes_select" on pcm.clientes;               -- e demais policies abaixo
--   drop table if exists config.usuarios;
--
-- O que este arquivo faz:
--   1. Tabela config.usuarios — fonte de verdade do papel do usuário (1:1 com auth.users).
--   2. Função config.provisionar_usuario — único caminho documentado para criar o vínculo
--      usuário↔papel (sem trigger automático — ver design.md "Provisionamento de usuário").
--   3. Função config.custom_access_token_hook — injeta o claim `user_role` no JWT emitido pelo
--      Supabase Auth. Precisa ser registrada como Auth Hook do projeto (não só aplicada via SQL —
--      ver supabase/config.toml para o ambiente local; produção é configurada no Dashboard).
--   4. GRANT base (USAGE nos schemas + SELECT/INSERT/UPDATE nas tabelas) para `authenticated` —
--      sem isso o Postgres nega antes de sequer avaliar a RLS policy ("permission denied for
--      schema"); achado rodando `supabase test db` pela 1ª vez (job db-tests do CI).
--   5. RLS policies nas 7 tabelas de domínio já existentes, lendo `auth.jwt() ->> 'user_role'`
--      (mesmo padrão do perfil single-repo em db/rls.template.sql) — sem subquery a
--      config.usuarios em tempo de policy (evita custo e recursão).

-- ─────────────────────────── CONFIG.USUARIOS ───────────────────────────────

create table if not exists config.usuarios (
  user_id      uuid        primary key references auth.users (id) on delete cascade,
  papel        text        not null check (papel in ('admin', 'escritorio', 'tecnico', 'cliente-sindico')),
  nome         text        not null,
  ativo        boolean     not null default true,
  created_at   timestamptz not null default now(),
  -- created_by/updated_by são nullable aqui (diferente do padrão das tabelas de domínio):
  -- o provisionamento roda via SQL Editor/script administrativo, sem sessão de app autenticada
  -- (auth.uid() indisponível nesse contexto) — ver runbooks/provisionar-usuario.md.
  created_by   uuid        references auth.users (id),
  updated_at   timestamptz,
  updated_by   uuid        references auth.users (id)
);

alter table config.usuarios enable row level security;
alter table config.usuarios force row level security;

-- Usuário lê o próprio registro; admin lê/edita todos.
create policy "usuarios_select" on config.usuarios
  for select to authenticated
  using (user_id = auth.uid() or auth.jwt() ->> 'user_role' = 'admin');

create policy "usuarios_update" on config.usuarios
  for update to authenticated
  using (auth.jwt() ->> 'user_role' = 'admin')
  with check (auth.jwt() ->> 'user_role' = 'admin');

-- Requisito do Custom Access Token Hook (ver seção abaixo): o Supabase Auth consulta esta tabela
-- conectado como o role `supabase_auth_admin`, que por padrão não tem acesso — precisa de grant +
-- policy explícita (padrão documentado pelo Supabase para hooks de claim customizado).
grant usage on schema config to supabase_auth_admin;
grant select on config.usuarios to supabase_auth_admin;

create policy "config.usuarios: auth admin le hook" on config.usuarios
  for select to supabase_auth_admin
  using (true);

-- ─────────────────────────── PROVISIONAMENTO ───────────────────────────────

-- Único caminho documentado para vincular um auth.users a um papel (ver runbooks/provisionar-usuario.md).
-- Não há trigger automático em auth.users: o papel não pode ser inferido, e a constraint
-- `not null` acima garante que toda linha que existir em config.usuarios tem papel válido.
--
-- Não existe policy de INSERT em config.usuarios de propósito: o INSERT dentro desta função
-- só funciona se o role que a executa tiver BYPASSRLS (o `postgres` do Supabase tem, tanto local
-- quanto hospedado — é o mesmo motivo pelo qual o SQL Editor do Dashboard consegue rodar isto).
-- Rodar como `authenticated`/`anon` falharia com "new row violates row-level security policy"
-- mesmo sendo security definer — FORCE ROW LEVEL SECURITY não é contornável só por SECURITY
-- DEFINER, exige BYPASSRLS de fato. @qa: validar essa suposição ao rodar `supabase db reset`
-- localmente (task 1/2 de tasks.md) antes do merge.
create or replace function config.provisionar_usuario(
  p_user_id uuid,
  p_papel   text,
  p_nome    text
)
returns config.usuarios
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row config.usuarios;
begin
  insert into config.usuarios (user_id, papel, nome)
  values (p_user_id, p_papel, p_nome)
  returning * into v_row;

  return v_row;
end;
$$;

-- Só executável por quem já bypassa RLS (postgres/service_role via SQL Editor ou script
-- administrativo) — nunca pelo client (anon/authenticated). Ver runbooks/provisionar-usuario.md.
revoke execute on function config.provisionar_usuario(uuid, text, text) from public, anon, authenticated;

-- ─────────────────────────── CUSTOM ACCESS TOKEN HOOK ──────────────────────

-- Roda a cada emissão/refresh de token (não a cada request de dado). Injeta `user_role` no JWT
-- a partir de config.usuarios. Se não houver perfil (ou estiver inativo), o claim vem `null` —
-- toda RLS policy abaixo nega por padrão (deny by default, AC-9), e o frontend trata a ausência
-- do claim como "conta sem perfil configurado" (ver design.md).
create or replace function config.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_papel  text;
  v_claims jsonb;
begin
  select papel into v_papel
    from config.usuarios
   where user_id = (event ->> 'user_id')::uuid
     and ativo = true;

  v_claims := coalesce(event -> 'claims', '{}'::jsonb);
  v_claims := jsonb_set(v_claims, '{user_role}', to_jsonb(v_papel)); -- vira JSON null se v_papel for null

  event := jsonb_set(event, '{claims}', v_claims);
  return event;
end;
$$;

grant execute on function config.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function config.custom_access_token_hook(jsonb) from public, anon, authenticated;

-- ─────────────────────────── GRANT BASE (pré-requisito da RLS) ─────────────
-- Postgres checa privilégio de schema/tabela ANTES de avaliar RLS — sem este GRANT, toda query
-- de `authenticated` a estas tabelas falha com "permission denied for schema", mesmo com a
-- policy certa abaixo. `anon` não recebe nada (deny by default, AC-9): schemas de domínio nunca
-- são acessíveis sem sessão autenticada. RLS continua sendo quem decide QUAIS linhas cada papel
-- vê — este GRANT só abre a possibilidade de a policy ser avaliada.
grant usage on schema pcm, atendimento, comercial, config to authenticated;

grant select, insert, update on pcm.clientes, pcm.ordens_servico to authenticated;
grant select, insert, update on atendimento.config_ze, atendimento.wa_messages, atendimento.wa_queue
  to authenticated;
grant select, insert, update on comercial.leads to authenticated;
grant select, insert, update on config.feature_flags to authenticated;
grant select, update on config.usuarios to authenticated; -- insert só via provisionar_usuario (SECURITY DEFINER)

-- ─────────────────────────── RLS — TABELAS DE DOMÍNIO EXISTENTES ───────────
-- Matriz de decisão completa: specs/E00-S05-autenticacao-autorizacao/spec.md (AC-8, AC-9).
-- Sem policy de DELETE em nenhuma tabela: exclusão é sempre via soft delete (`deleted_at`),
-- nunca DELETE físico — FORCE ROW LEVEL SECURITY sem policy de delete bloqueia a operação
-- para todos, inclusive admin (comportamento intencional).

-- pcm.clientes — admin/escritorio leitura+escrita, tecnico só leitura
create policy "clientes_select" on pcm.clientes
  for select to authenticated
  using (auth.jwt() ->> 'user_role' in ('admin', 'escritorio', 'tecnico'));

create policy "clientes_insert" on pcm.clientes
  for insert to authenticated
  with check (auth.jwt() ->> 'user_role' in ('admin', 'escritorio'));

create policy "clientes_update" on pcm.clientes
  for update to authenticated
  using (auth.jwt() ->> 'user_role' in ('admin', 'escritorio'))
  with check (auth.jwt() ->> 'user_role' in ('admin', 'escritorio'));

-- pcm.ordens_servico — admin/escritorio leitura+escrita, tecnico só leitura
create policy "ordens_servico_select" on pcm.ordens_servico
  for select to authenticated
  using (auth.jwt() ->> 'user_role' in ('admin', 'escritorio', 'tecnico'));

create policy "ordens_servico_insert" on pcm.ordens_servico
  for insert to authenticated
  with check (auth.jwt() ->> 'user_role' in ('admin', 'escritorio'));

create policy "ordens_servico_update" on pcm.ordens_servico
  for update to authenticated
  using (auth.jwt() ->> 'user_role' in ('admin', 'escritorio'))
  with check (auth.jwt() ->> 'user_role' in ('admin', 'escritorio'));

-- atendimento.config_ze — admin/escritorio apenas (tecnico e cliente-sindico sem acesso)
create policy "config_ze_select" on atendimento.config_ze
  for select to authenticated
  using (auth.jwt() ->> 'user_role' in ('admin', 'escritorio'));

create policy "config_ze_insert" on atendimento.config_ze
  for insert to authenticated
  with check (auth.jwt() ->> 'user_role' in ('admin', 'escritorio'));

create policy "config_ze_update" on atendimento.config_ze
  for update to authenticated
  using (auth.jwt() ->> 'user_role' in ('admin', 'escritorio'))
  with check (auth.jwt() ->> 'user_role' in ('admin', 'escritorio'));

-- atendimento.wa_messages — admin/escritorio apenas
create policy "wa_messages_select" on atendimento.wa_messages
  for select to authenticated
  using (auth.jwt() ->> 'user_role' in ('admin', 'escritorio'));

create policy "wa_messages_insert" on atendimento.wa_messages
  for insert to authenticated
  with check (auth.jwt() ->> 'user_role' in ('admin', 'escritorio'));

create policy "wa_messages_update" on atendimento.wa_messages
  for update to authenticated
  using (auth.jwt() ->> 'user_role' in ('admin', 'escritorio'))
  with check (auth.jwt() ->> 'user_role' in ('admin', 'escritorio'));

-- atendimento.wa_queue — admin/escritorio apenas
create policy "wa_queue_select" on atendimento.wa_queue
  for select to authenticated
  using (auth.jwt() ->> 'user_role' in ('admin', 'escritorio'));

create policy "wa_queue_insert" on atendimento.wa_queue
  for insert to authenticated
  with check (auth.jwt() ->> 'user_role' in ('admin', 'escritorio'));

create policy "wa_queue_update" on atendimento.wa_queue
  for update to authenticated
  using (auth.jwt() ->> 'user_role' in ('admin', 'escritorio'))
  with check (auth.jwt() ->> 'user_role' in ('admin', 'escritorio'));

-- comercial.leads — admin/escritorio apenas
create policy "leads_select" on comercial.leads
  for select to authenticated
  using (auth.jwt() ->> 'user_role' in ('admin', 'escritorio'));

create policy "leads_insert" on comercial.leads
  for insert to authenticated
  with check (auth.jwt() ->> 'user_role' in ('admin', 'escritorio'));

create policy "leads_update" on comercial.leads
  for update to authenticated
  using (auth.jwt() ->> 'user_role' in ('admin', 'escritorio'))
  with check (auth.jwt() ->> 'user_role' in ('admin', 'escritorio'));

-- config.feature_flags — admin leitura+escrita, escritorio só leitura
create policy "feature_flags_select" on config.feature_flags
  for select to authenticated
  using (auth.jwt() ->> 'user_role' in ('admin', 'escritorio'));

create policy "feature_flags_insert" on config.feature_flags
  for insert to authenticated
  with check (auth.jwt() ->> 'user_role' = 'admin');

create policy "feature_flags_update" on config.feature_flags
  for update to authenticated
  using (auth.jwt() ->> 'user_role' = 'admin')
  with check (auth.jwt() ->> 'user_role' = 'admin');

-- ── Verificação (rode após aplicar) ────────────────────────────────────────
-- select tablename, policyname, cmd from pg_policies
--  where schemaname in ('pcm','atendimento','comercial','config') order by tablename, cmd;
