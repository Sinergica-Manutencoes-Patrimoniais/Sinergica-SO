-- ADR-0406: fail-closed enquanto não existir protocolo comum entre escritores.
create table pcm.visita_composicao_serializacao_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.visita_composicao_serializacao_gate(id,habilitado) values(true,false);
alter table pcm.visita_composicao_serializacao_gate enable row level security;
alter table pcm.visita_composicao_serializacao_gate force row level security;
revoke all on pcm.visita_composicao_serializacao_gate from public,anon,authenticated,service_role;
alter function pcm.sso_registrar_intencao_envio_local(uuid,uuid,uuid,integer) rename to sso_registrar_intencao_envio_local_base_0632;
revoke all on function pcm.sso_registrar_intencao_envio_local_base_0632(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
create function pcm.sso_registrar_intencao_envio_local(p_request_id uuid,p_visita_id uuid,p_os_id uuid,p_revisao integer)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.visita_composicao_serializacao_gate where id),false) then
    raise exception 'serializacao_composicao_indisponivel' using errcode='55000';
  end if;
  return pcm.sso_registrar_intencao_envio_local_base_0632(p_request_id,p_visita_id,p_os_id,p_revisao);
end $$;
revoke all on function pcm.sso_registrar_intencao_envio_local(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
