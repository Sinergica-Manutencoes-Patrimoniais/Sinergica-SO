-- ADR-1266: somente serviço, gates existentes e gate adicional fechados.
create table pcm.sso_t24_resultado_servico_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_t24_resultado_servico_gate(id, habilitado) values(true, false);
alter table pcm.sso_t24_resultado_servico_gate enable row level security;
alter table pcm.sso_t24_resultado_servico_gate force row level security;
revoke all on pcm.sso_t24_resultado_servico_gate from public,anon,authenticated,service_role;

create function pcm.sso_t24_resultado_outbox_servico(p_request_id uuid,p_tentativa_id uuid,p_fence bigint,p_estado text,p_tarefa_observada text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'sem_acesso' using errcode = '42501'; end if;
  perform 1 from pcm.sso_t24_resultado_servico_gate where id and habilitado for share;
  if not found then raise exception 'resultado_desabilitado' using errcode = '55000'; end if;
  return pcm.sso_t24_registrar_resultado_outbox(p_request_id,p_tentativa_id,p_fence,p_estado,p_tarefa_observada,p_motivo);
end $$;
revoke all on function pcm.sso_t24_resultado_outbox_servico(uuid,uuid,bigint,text,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_t24_resultado_outbox_servico(uuid,uuid,bigint,text,text,text) to service_role;
grant execute on function pcm.sso_t24_reservar_candidata(integer) to service_role;
grant execute on function pcm.sso_t24_iniciar_efeito(uuid,uuid,bigint) to service_role;
grant execute on function pcm.sso_t24_confirmar_efeito(uuid,uuid,bigint,text,jsonb) to service_role;
grant execute on function pcm.sso_t24_registrar_resposta_tardia(uuid,uuid,bigint,text,text) to service_role;
