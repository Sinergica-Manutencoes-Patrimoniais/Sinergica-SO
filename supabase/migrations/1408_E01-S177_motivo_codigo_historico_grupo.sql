-- ADR-1255: leitura administrativa e restrita, gate fechado.
create table pcm.sso_motivo_codigo_grupo_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_motivo_codigo_grupo_gate(id, habilitado) values(true, false);
alter table pcm.sso_motivo_codigo_grupo_gate enable row level security;
alter table pcm.sso_motivo_codigo_grupo_gate force row level security;
revoke all on pcm.sso_motivo_codigo_grupo_gate from public, anon, authenticated, service_role;

create function pcm.sso_motivo_codigo_historico_grupo(p_cliente_id uuid, p_grupo_id uuid, p_codigo_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_codigo text; v_total bigint; v_resultado jsonb;
begin
  if auth.uid() is null or p_cliente_id is null or p_grupo_id is null or p_codigo_id is null then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode = '55P03'; end if;
  perform 1 from pcm.sso_motivo_codigo_grupo_gate where id and habilitado for share;
  if not found then raise exception 'consulta_desabilitada' using errcode = '55000'; end if;
  if config.sso_autorizar_acao('codigo.substituir',p_cliente_id) is not true or not exists
    (select 1 from config.usuarios u where u.user_id=auth.uid() and u.ativo and u.papel='superadmin' and auth.jwt()->>'user_role'='superadmin') then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-codigos-publicos',0)) then raise exception 'codigo_em_alteracao' using errcode = '55P03'; end if;
  select c.codigo into v_codigo from pcm.sso_codigos_grupo_quantitativo c join pcm.grupos_quantitativos g on g.id=c.grupo_id and g.cliente_id=c.cliente_id
    where c.id=p_codigo_id and c.grupo_id=p_grupo_id and c.cliente_id=p_cliente_id and not c.atual and g.deleted_at is null;
  if not found then raise exception 'codigo_indisponivel_ou_sem_acesso' using errcode = '42501'; end if;
  select count(*) into v_total from audit.events e where e.entity='grupo_quantitativo' and e.entity_id=p_grupo_id and e.action='codigo.substituido'
    and e.payload->>'clienteId'=p_cliente_id::text and e.payload->>'codigoAnterior'=v_codigo;
  if v_total=0 then return null; end if;
  if v_total<>1 then raise exception 'historico_ambiguo' using errcode = '23514'; end if;
  select jsonb_build_object('codigoId',p_codigo_id,'grupoId',p_grupo_id,'clienteId',p_cliente_id,'motivo',e.payload->>'motivo',
    'atorId',e.actor_id,'data',e.created_at) into v_resultado from audit.events e
    where e.entity='grupo_quantitativo' and e.entity_id=p_grupo_id and e.action='codigo.substituido'
      and e.payload->>'clienteId'=p_cliente_id::text and e.payload->>'codigoAnterior'=v_codigo;
  return v_resultado;
end $$;
revoke all on function pcm.sso_motivo_codigo_historico_grupo(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_motivo_codigo_historico_grupo(uuid,uuid,uuid) to authenticated;
