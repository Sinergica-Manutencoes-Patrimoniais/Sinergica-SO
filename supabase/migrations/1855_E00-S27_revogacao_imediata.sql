-- E00-S27 — Revogação imediata de acesso (ADR-1691).
--
-- Achado antes de codar: `config.s184_acesso_interno_atual` (0234, E01-S184) já resolve o
-- problema de fundo — RLS que confia só em `auth.jwt()` fica cego a revogação até o token
-- expirar; a correção é uma policy RESTRICTIVE que relê `config.usuarios`/
-- `resolver_permissoes_modulo` AO VIVO a cada linha, em vez de confiar no que foi carimbado no
-- JWT no login. `config.sso_autorizar_acao` (E01-S170) já faz a mesma releitura ao vivo pro lado
-- de RPC/ação sensível — confirmado por `SEC-007`/`PR #73`. Esta migration generaliza o padrão
-- do 0234 (hoje hardcoded pra 5 tabelas de comercial/pcm) numa função nomeada e reusável, e
-- fecha o que faltava: revogar/reativar usuário vira comando auditado (não `update` cru), com
-- teste provando que a MESMA sessão (mesmo JWT, sem novo login) perde e recupera acesso.
--
-- Reverso: drop function config.sso_acesso_atual(text, text);
--          drop function config.sso_revogar_usuario(uuid, uuid, text);
--          drop function config.sso_reativar_usuario(uuid, uuid, text);
--          drop table config.sso_revogacoes_usuario;
--          (não remover as policies s184_acesso_interno_atual nem as que já existirem usando
--          config.sso_acesso_atual — eram a mitigação original, tirar é reabrir SEC-004/SEC-007)

-- Generalização do padrão 0234: mesma releitura ao vivo, parametrizada por módulo e nível, pra
-- não precisar duplicar a função a cada tabela nova que precise da mesma garantia.
create or replace function config.sso_acesso_atual(p_modulo text, p_nivel text default 'leitura')
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from config.usuarios u
    where u.user_id = auth.uid() and u.ativo
      and u.papel = auth.jwt() ->> 'user_role'
      and u.papel <> 'cliente-sindico'
      and (u.papel = 'superadmin' or exists (
        select 1 from config.resolver_permissoes_modulo(u.user_id) m
        where m.modulo = p_modulo and (m.nivel = 'escrita' or p_nivel = 'leitura')
      ))
  );
$$;
revoke all on function config.sso_acesso_atual(text, text) from public, anon;
grant execute on function config.sso_acesso_atual(text, text) to authenticated;

-- AC-3/AC-6: revogar e reativar usuário passam a ser comando auditado, idempotente por
-- request_id — mesmo padrão de config.sso_definir_concessao (0240/0241), nunca UPDATE cru.
create table config.sso_revogacoes_usuario (
  request_id uuid primary key,
  usuario_id uuid not null references config.usuarios(user_id),
  ator_id uuid not null references auth.users(id),
  acao text not null check (acao in ('revogar', 'reativar')),
  motivo text not null check (length(btrim(motivo)) between 1 and 1000),
  criado_em timestamptz not null default now()
);
alter table config.sso_revogacoes_usuario enable row level security;
alter table config.sso_revogacoes_usuario force row level security;
revoke all on config.sso_revogacoes_usuario from public, anon, authenticated, service_role;

create function config.sso_revogar_usuario(p_request_id uuid, p_usuario_id uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ator uuid := auth.uid();
  v_motivo text := nullif(btrim(p_motivo), '');
  v_anterior config.usuarios%rowtype;
  v_existe config.sso_revogacoes_usuario%rowtype;
  v_resultado jsonb;
begin
  if v_ator is null or p_request_id is null or p_usuario_id is null or v_motivo is null or length(v_motivo) > 1000 then
    raise exception 'pedido_invalido' using errcode = '22023';
  end if;
  if coalesce((select u.papel from config.usuarios u where u.user_id = v_ator and u.ativo), '') <> 'superadmin' then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  -- Autorrevogação trava o único caminho de voltar (sso_reativar_usuario também exige
  -- ativo=true pra chamar) — achado de /revisao-adversarial, 18/11/2026.
  if p_usuario_id = v_ator then raise exception 'nao_pode_revogar_a_si_mesmo' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-revogacao:' || p_request_id::text, 0));
  select * into v_existe from config.sso_revogacoes_usuario where request_id = p_request_id;
  if found then
    if v_existe.ator_id is distinct from v_ator or v_existe.usuario_id is distinct from p_usuario_id then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return jsonb_build_object('usuarioId', v_existe.usuario_id, 'acao', v_existe.acao, 'requestId', p_request_id);
  end if;
  select * into v_anterior from config.usuarios where user_id = p_usuario_id for update;
  if not found then raise exception 'usuario_inexistente' using errcode = '22023'; end if;
  update config.usuarios set ativo = false, updated_at = now(), updated_by = v_ator where user_id = p_usuario_id;
  insert into config.sso_revogacoes_usuario(request_id, usuario_id, ator_id, acao, motivo) values (p_request_id, p_usuario_id, v_ator, 'revogar', v_motivo);
  v_resultado := jsonb_build_object('usuarioId', p_usuario_id, 'acao', 'revogar', 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload) values (v_ator, 'usuario.revogado', 'usuarios', p_usuario_id, v_resultado || jsonb_build_object('motivo', v_motivo, 'ativoAnterior', v_anterior.ativo));
  return v_resultado;
end;
$$;
revoke all on function config.sso_revogar_usuario(uuid, uuid, text) from public, anon;
grant execute on function config.sso_revogar_usuario(uuid, uuid, text) to authenticated;

create function config.sso_reativar_usuario(p_request_id uuid, p_usuario_id uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ator uuid := auth.uid();
  v_motivo text := nullif(btrim(p_motivo), '');
  v_anterior config.usuarios%rowtype;
  v_existe config.sso_revogacoes_usuario%rowtype;
  v_resultado jsonb;
begin
  if v_ator is null or p_request_id is null or p_usuario_id is null or v_motivo is null or length(v_motivo) > 1000 then
    raise exception 'pedido_invalido' using errcode = '22023';
  end if;
  if coalesce((select u.papel from config.usuarios u where u.user_id = v_ator and u.ativo), '') <> 'superadmin' then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-revogacao:' || p_request_id::text, 0));
  select * into v_existe from config.sso_revogacoes_usuario where request_id = p_request_id;
  if found then
    if v_existe.ator_id is distinct from v_ator or v_existe.usuario_id is distinct from p_usuario_id then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return jsonb_build_object('usuarioId', v_existe.usuario_id, 'acao', v_existe.acao, 'requestId', p_request_id);
  end if;
  select * into v_anterior from config.usuarios where user_id = p_usuario_id for update;
  if not found then raise exception 'usuario_inexistente' using errcode = '22023'; end if;
  update config.usuarios set ativo = true, updated_at = now(), updated_by = v_ator where user_id = p_usuario_id;
  insert into config.sso_revogacoes_usuario(request_id, usuario_id, ator_id, acao, motivo) values (p_request_id, p_usuario_id, v_ator, 'reativar', v_motivo);
  v_resultado := jsonb_build_object('usuarioId', p_usuario_id, 'acao', 'reativar', 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload) values (v_ator, 'usuario.reativado', 'usuarios', p_usuario_id, v_resultado || jsonb_build_object('motivo', v_motivo, 'ativoAnterior', v_anterior.ativo));
  return v_resultado;
end;
$$;
revoke all on function config.sso_reativar_usuario(uuid, uuid, text) from public, anon;
grant execute on function config.sso_reativar_usuario(uuid, uuid, text) to authenticated;
