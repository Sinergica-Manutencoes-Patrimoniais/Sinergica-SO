-- ADR-1263: leitura administrativa agregada; gate fechado.
create table pcm.sso_diagnostico_executor_admin_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_diagnostico_executor_admin_gate(id, habilitado) values(true, false);
alter table pcm.sso_diagnostico_executor_admin_gate enable row level security;
alter table pcm.sso_diagnostico_executor_admin_gate force row level security;
revoke all on pcm.sso_diagnostico_executor_admin_gate from public, anon, authenticated, service_role;

create function pcm.sso_diagnosticar_executor_fila_admin(p_ator_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_resultado jsonb;
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode = '25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id then raise exception 'sem_acesso' using errcode = '42501'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode = '55P03'; end if;
  perform 1 from pcm.sso_diagnostico_executor_admin_gate where id and habilitado for share;
  if not found then raise exception 'diagnostico_desabilitado' using errcode = '55000'; end if;
  if coalesce(auth.jwt()->>'user_role','') <> 'superadmin' or not exists(select 1 from config.usuarios u where u.user_id=p_ator_id and u.ativo and u.papel='superadmin') then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  v_resultado := pcm.sso_diagnosticar_executor_varredura_fila();
  if not exists(select 1 from config.usuarios u where u.user_id=p_ator_id and u.ativo and u.papel='superadmin') then raise exception 'sem_acesso' using errcode = '42501'; end if;
  return v_resultado;
end $$;
revoke all on function pcm.sso_diagnosticar_executor_fila_admin(uuid) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_diagnosticar_executor_fila_admin(uuid) to authenticated;
