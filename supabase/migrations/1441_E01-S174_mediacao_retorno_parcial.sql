-- ADR-1294: entradas autenticadas, sem abrir gates dos núcleos.
create function pcm.sso_consultar_retorno_parcial_mediado(p_ator_id uuid,p_cliente_id uuid,p_ciclo_id uuid,p_proposta_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_ator_id then raise exception 'sem_acesso' using errcode='42501'; end if;
  return pcm.sso_consultar_retorno_parcial(p_cliente_id,p_ciclo_id,p_proposta_id);
end; $$;
revoke all on function pcm.sso_consultar_retorno_parcial_mediado(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_retorno_parcial_mediado(uuid,uuid,uuid,uuid) to authenticated;

create function pcm.sso_devolver_continuacao_parcial_mediado(p_request_id uuid,p_ator_esperado uuid,p_cliente_id uuid,p_ciclo_id uuid,p_retorno_id uuid,
  p_ciclo_revision integer,p_suspensao_revision integer,p_interrupcao_revision integer,p_revisao_humana integer,
  p_vinculo_request_id uuid,p_proposta_sha256 text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_ator_esperado then raise exception 'sem_acesso' using errcode='42501'; end if;
  return pcm.sso_devolver_continuacao_parcial(p_request_id,p_ator_esperado,p_cliente_id,p_ciclo_id,p_retorno_id,
    p_ciclo_revision,p_suspensao_revision,p_interrupcao_revision,p_revisao_humana,p_vinculo_request_id,p_proposta_sha256,p_motivo);
end; $$;
revoke all on function pcm.sso_devolver_continuacao_parcial_mediado(uuid,uuid,uuid,uuid,uuid,integer,integer,integer,integer,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_devolver_continuacao_parcial_mediado(uuid,uuid,uuid,uuid,uuid,integer,integer,integer,integer,uuid,text,text) to authenticated;
