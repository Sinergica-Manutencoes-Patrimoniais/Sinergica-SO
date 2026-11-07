-- ADR-0485: proteção parcial, desligada por padrão; sem reenvio nem alteração de dados.
create table pcm.reconciliacao_retry_incerto_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.reconciliacao_retry_incerto_gate(id,habilitado) values(true,false);
alter table pcm.reconciliacao_retry_incerto_gate enable row level security;
alter table pcm.reconciliacao_retry_incerto_gate force row level security;
revoke all on pcm.reconciliacao_retry_incerto_gate from public,anon,authenticated,service_role;
create function pcm.sso_guardar_retry_incerto() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.reconciliacao_retry_incerto_gate where id),false) then return new; end if;
  if old.status in ('error','processing') and new.status='pending' then raise exception 'resultado_remoto_incerto_retry_bloqueado' using errcode='55000'; end if;
  return new;
end $$;
revoke all on function pcm.sso_guardar_retry_incerto() from public,anon,authenticated,service_role;
create trigger sso_bloquear_retry_incerto before update of status on pcm.auvo_sync_outbox for each row execute function pcm.sso_guardar_retry_incerto();
