-- ADR-1289: recibo restrito, sem efeito sobre permissões.
create table config.sso_recibo_capacidades_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into config.sso_recibo_capacidades_gate(id,habilitado) values(true,false);
alter table config.sso_recibo_capacidades_gate enable row level security;
alter table config.sso_recibo_capacidades_gate force row level security;
revoke all on config.sso_recibo_capacidades_gate from public,anon,authenticated,service_role;

create function config.sso_consultar_recibo_capacidades(p_request_id uuid,p_payload jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_request_id is null or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>8192 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from config.sso_recibo_capacidades_gate where id and habilitado for share;
  if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
  if not exists(select 1 from config.usuarios u where u.user_id=auth.uid() and u.ativo and u.papel='superadmin' and auth.jwt()->>'user_role'='superadmin') then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not exists(select 1 from config.sso_comandos c where c.request_id=p_request_id and c.actor_id=auth.uid() and c.payload=p_payload) then raise exception 'recibo_indisponivel' using errcode='42501'; end if;
  return jsonb_build_object('requestId',p_request_id,'confirmado',true);
end; $$;
revoke all on function config.sso_consultar_recibo_capacidades(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function config.sso_consultar_recibo_capacidades(uuid,jsonb) to authenticated;
