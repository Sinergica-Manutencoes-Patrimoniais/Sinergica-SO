-- ADR-1330: proteção aditiva; gate fechado até validação e rollout coordenado.
create table pcm.sso_autorizacao_aprovacao_plano_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_autorizacao_aprovacao_plano_gate(id,habilitado) values(true,false);
alter table pcm.sso_autorizacao_aprovacao_plano_gate enable row level security;
alter table pcm.sso_autorizacao_aprovacao_plano_gate force row level security;
revoke all on pcm.sso_autorizacao_aprovacao_plano_gate from public,anon,authenticated,service_role;

create function pcm.sso_exigir_autorizacao_aprovacao_plano() returns void
language plpgsql volatile security definer set search_path='' as $$
declare v_ativo boolean;
begin
  select habilitado into v_ativo from pcm.sso_autorizacao_aprovacao_plano_gate where id for share;
  if not found then raise exception 'gate_indisponivel' using errcode='55000'; end if;
  if not v_ativo then return; end if;
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03';
  end if;
end; $$;
revoke all on function pcm.sso_exigir_autorizacao_aprovacao_plano() from public,anon,authenticated,service_role;

do $alteracao$
declare
  v_def text := pg_catalog.pg_get_functiondef('pcm.sso_aprovar_plano(uuid,integer,uuid,date)'::regprocedure);
  v_marcador text := 'perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(''plano-request:'' || p_request_id::text, 0));';
begin
  if strpos(v_def,v_marcador)=0 or length(v_def)-length(replace(v_def,v_marcador,''))<>length(v_marcador)
    or strpos(v_def,'sso_exigir_autorizacao_aprovacao_plano')>0 then raise exception 'definicao_aprovacao_plano_incompativel' using errcode='55000'; end if;
  execute replace(v_def,v_marcador,'perform pcm.sso_exigir_autorizacao_aprovacao_plano(); '||v_marcador);
end;
$alteracao$;
