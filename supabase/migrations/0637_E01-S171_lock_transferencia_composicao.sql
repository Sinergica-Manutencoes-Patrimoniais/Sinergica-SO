-- ADR-0411: extensão parcial de protocolo; não liberar a guarda de serialização.
create function pcm.sso_lock_transferencia_composicao(p_request_id uuid,p_origem_id uuid,p_destino_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.visita_composicao_conferencia_gate where id),false)
    or p_request_id is null or p_origem_id is null or p_destino_id is null then return; end if;
  perform pcm.sso_lock_escritor_composicao(p_request_id,least(p_origem_id,p_destino_id));
  if p_origem_id<>p_destino_id then perform pcm.sso_lock_escritor_composicao(p_request_id,greatest(p_origem_id,p_destino_id)); end if;
end $$;
revoke all on function pcm.sso_lock_transferencia_composicao(uuid,uuid,uuid) from public,anon,authenticated,service_role;

alter function pcm.sso_encerrar_membro_visita(uuid,integer,uuid,uuid,text) rename to sso_encerrar_membro_visita_base_0637;
revoke all on function pcm.sso_encerrar_membro_visita_base_0637(uuid,integer,uuid,uuid,text) from public,anon,authenticated,service_role;
create function pcm.sso_encerrar_membro_visita(p_request_id uuid,p_expected_revision integer,p_visita_id uuid,p_participacao_id uuid,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform pcm.sso_lock_escritor_composicao(p_request_id,p_visita_id);
  return pcm.sso_encerrar_membro_visita_base_0637(p_request_id,p_expected_revision,p_visita_id,p_participacao_id,p_motivo);
end $$;
revoke all on function pcm.sso_encerrar_membro_visita(uuid,integer,uuid,uuid,text) from public,anon;
grant execute on function pcm.sso_encerrar_membro_visita(uuid,integer,uuid,uuid,text) to authenticated;

alter function pcm.sso_desvincular_os_visita(uuid,integer,uuid,uuid,text) rename to sso_desvincular_os_visita_base_0637;
revoke all on function pcm.sso_desvincular_os_visita_base_0637(uuid,integer,uuid,uuid,text) from public,anon,authenticated,service_role;
create function pcm.sso_desvincular_os_visita(p_request_id uuid,p_expected_revision integer,p_visita_id uuid,p_vinculo_id uuid,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform pcm.sso_lock_escritor_composicao(p_request_id,p_visita_id);
  return pcm.sso_desvincular_os_visita_base_0637(p_request_id,p_expected_revision,p_visita_id,p_vinculo_id,p_motivo);
end $$;
revoke all on function pcm.sso_desvincular_os_visita(uuid,integer,uuid,uuid,text) from public,anon;
grant execute on function pcm.sso_desvincular_os_visita(uuid,integer,uuid,uuid,text) to authenticated;

alter function pcm.sso_transferir_os_visita_preparado(uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text) rename to sso_transferir_os_visita_base_0637;
revoke all on function pcm.sso_transferir_os_visita_base_0637(uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text) from public,anon,authenticated,service_role;
create function pcm.sso_transferir_os_visita_preparado(p_request_id uuid,p_origem_id uuid,p_destino_id uuid,p_vinculo_id uuid,p_novo_vinculo_id uuid,p_revisao_origem integer,p_revisao_destino integer,p_sequencia integer,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform pcm.sso_lock_transferencia_composicao(p_request_id,p_origem_id,p_destino_id);
  return pcm.sso_transferir_os_visita_base_0637(p_request_id,p_origem_id,p_destino_id,p_vinculo_id,p_novo_vinculo_id,p_revisao_origem,p_revisao_destino,p_sequencia,p_motivo);
end $$;
revoke all on function pcm.sso_transferir_os_visita_preparado(uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text) from public,anon,authenticated,service_role;

alter function pcm.sso_transferir_os_confirmada_preparado(uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text) rename to sso_transferir_os_confirmada_base_0637;
revoke all on function pcm.sso_transferir_os_confirmada_base_0637(uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text) from public,anon,authenticated,service_role;
create function pcm.sso_transferir_os_confirmada_preparado(p_request_id uuid,p_origem_id uuid,p_destino_id uuid,p_vinculo_id uuid,p_novo_vinculo_id uuid,p_revisao_origem integer,p_revisao_destino integer,p_sequencia integer,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform pcm.sso_lock_transferencia_composicao(p_request_id,p_origem_id,p_destino_id);
  return pcm.sso_transferir_os_confirmada_base_0637(p_request_id,p_origem_id,p_destino_id,p_vinculo_id,p_novo_vinculo_id,p_revisao_origem,p_revisao_destino,p_sequencia,p_motivo);
end $$;
revoke all on function pcm.sso_transferir_os_confirmada_preparado(uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text) from public,anon,authenticated,service_role;
