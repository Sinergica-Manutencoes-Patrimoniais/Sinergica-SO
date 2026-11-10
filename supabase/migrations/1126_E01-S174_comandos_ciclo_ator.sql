-- ADR-0975: mediadores privados; gates e autorizações pertencem aos comandos internos.
create function pcm.sso_inicializar_ciclo_backlog_ator(p_request_id uuid,p_ator_esperado uuid,p_cliente_id uuid,p_pendencia_id uuid,p_ciclo_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_ator_esperado then raise exception 'ator_incompativel' using errcode='42501'; end if;
  return pcm.sso_inicializar_ciclo_backlog(p_request_id,p_cliente_id,p_pendencia_id,p_ciclo_id);
end; $$;
revoke all on function pcm.sso_inicializar_ciclo_backlog_ator(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_devolver_ciclo_backlog_ator(p_request_id uuid,p_ator_esperado uuid,p_cliente_id uuid,p_ciclo_id uuid,p_retorno_id uuid,
  p_ciclo_revision integer,p_suspensao_revision integer,p_interrupcao_revision integer,p_reconciliacao_id uuid,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_ator_esperado then raise exception 'ator_incompativel' using errcode='42501'; end if;
  return pcm.sso_devolver_ciclo_backlog(p_request_id,p_cliente_id,p_ciclo_id,p_retorno_id,p_ciclo_revision,p_suspensao_revision,p_interrupcao_revision,p_reconciliacao_id,p_motivo);
end; $$;
revoke all on function pcm.sso_devolver_ciclo_backlog_ator(uuid,uuid,uuid,uuid,uuid,integer,integer,integer,uuid,text) from public,anon,authenticated,service_role;
