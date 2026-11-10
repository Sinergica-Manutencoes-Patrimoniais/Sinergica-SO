-- ADR-0408: wrappers compatíveis; cobertura parcial, guarda 0632 permanece fechada.
create function pcm.sso_lock_escritor_composicao(p_request_id uuid,p_visita_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if coalesce((select habilitado from pcm.visita_composicao_conferencia_gate where id),false)
    and p_request_id is not null and p_visita_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-request:'||p_request_id::text,0));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-composicao-scope:'||p_visita_id::text,0));
  end if;
end $$;
revoke all on function pcm.sso_lock_escritor_composicao(uuid,uuid) from public,anon,authenticated,service_role;

alter function pcm.sso_associar_os_visita(uuid,integer,uuid,uuid,uuid,integer,integer) rename to sso_associar_os_visita_base_0634;
revoke all on function pcm.sso_associar_os_visita_base_0634(uuid,integer,uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
create function pcm.sso_associar_os_visita(p_request_id uuid,p_expected_revision integer,p_visita_id uuid,p_os_id uuid,p_vinculo_id uuid,p_sequencia integer,p_estimativa_minutos integer)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform pcm.sso_lock_escritor_composicao(p_request_id,p_visita_id);
  return pcm.sso_associar_os_visita_base_0634(p_request_id,p_expected_revision,p_visita_id,p_os_id,p_vinculo_id,p_sequencia,p_estimativa_minutos);
end $$;
revoke all on function pcm.sso_associar_os_visita(uuid,integer,uuid,uuid,uuid,integer,integer) from public,anon;
grant execute on function pcm.sso_associar_os_visita(uuid,integer,uuid,uuid,uuid,integer,integer) to authenticated;

alter function pcm.sso_adicionar_membro_visita(uuid,integer,uuid,uuid,uuid,text,integer) rename to sso_adicionar_membro_visita_base_0634;
revoke all on function pcm.sso_adicionar_membro_visita_base_0634(uuid,integer,uuid,uuid,uuid,text,integer) from public,anon,authenticated,service_role;
create function pcm.sso_adicionar_membro_visita(p_request_id uuid,p_expected_revision integer,p_visita_id uuid,p_funcionario_id uuid,p_participacao_id uuid,p_papel text,p_estimativa_minutos integer)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform pcm.sso_lock_escritor_composicao(p_request_id,p_visita_id);
  return pcm.sso_adicionar_membro_visita_base_0634(p_request_id,p_expected_revision,p_visita_id,p_funcionario_id,p_participacao_id,p_papel,p_estimativa_minutos);
end $$;
revoke all on function pcm.sso_adicionar_membro_visita(uuid,integer,uuid,uuid,uuid,text,integer) from public,anon;
grant execute on function pcm.sso_adicionar_membro_visita(uuid,integer,uuid,uuid,uuid,text,integer) to authenticated;

create or replace function pcm.sso_registrar_intencao_envio_local(p_request_id uuid,p_visita_id uuid,p_os_id uuid,p_revisao integer)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.visita_composicao_serializacao_gate where id),false) then raise exception 'serializacao_composicao_indisponivel' using errcode='55000'; end if;
  perform pcm.sso_lock_escritor_composicao(p_request_id,p_visita_id);
  return pcm.sso_registrar_intencao_envio_local_base_0632(p_request_id,p_visita_id,p_os_id,p_revisao);
end $$;
revoke all on function pcm.sso_registrar_intencao_envio_local(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
