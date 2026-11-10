-- ADR-0848: proteção opt-in; nenhuma mudança de gate ou dados históricos.
create table pcm.sso_origem_os_retorno_gate (
  id boolean primary key default true check(id),
  habilitado boolean not null default false
);
insert into pcm.sso_origem_os_retorno_gate(id,habilitado) values(true,false);
alter table pcm.sso_origem_os_retorno_gate enable row level security;
alter table pcm.sso_origem_os_retorno_gate force row level security;
revoke all on pcm.sso_origem_os_retorno_gate from public,anon,authenticated,service_role;

create function pcm.sso_guardar_origem_os_com_retorno() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_habilitado boolean;
begin
  if new.ocorrencia_preventiva_id is not distinct from old.ocorrencia_preventiva_id
    and new.client_id is not distinct from old.client_id
    and new.auvo_task_id is not distinct from old.auvo_task_id
    and new.sistema_id is not distinct from old.sistema_id
    and new.equipamento_id is not distinct from old.equipamento_id then return new; end if;
  select habilitado into v_habilitado from pcm.sso_origem_os_retorno_gate where id for share;
  if v_habilitado is true and exists(select 1 from pcm.retorno_os_preparado r where r.os_id=old.id) then
    raise exception 'os_com_retorno_origem_imutavel' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_guardar_origem_os_com_retorno() from public,anon,authenticated,service_role;
create trigger sso_guardar_origem_os_com_retorno before update of ocorrencia_preventiva_id, client_id, auvo_task_id, sistema_id, equipamento_id on pcm.ordens_servico
for each row execute function pcm.sso_guardar_origem_os_com_retorno();
