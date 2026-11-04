-- ADR-1228: vincula o comando existente ao contexto autenticado exibido no Portal.
create function pcm.sso_portal_informar_material_mediado(
  p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_request_id uuid,
  p_lista_id uuid,p_expected_revision integer,p_situacao text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  if p_request_id is null or p_lista_id is null or p_expected_revision is null
    or p_expected_revision<1 or p_situacao is null
    or p_situacao not in ('informada_disponivel','parcial','indisponivel') then
    raise exception 'parametros_invalidos' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('portal-material:'||p_request_id::text,0));
  perform pcm.sso_exigir_historico_materiais_portal(p_ator_id,p_cliente_id,p_os_id);
  perform 1 from pcm.listas_materiais l where l.id=p_lista_id and l.cliente_id=p_cliente_id
    and l.ordem_servico_id=p_os_id and l.responsavel='cliente' for update;
  if not found then raise exception 'lista_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  return pcm.sso_portal_informar_material(p_request_id,p_lista_id,p_expected_revision,p_situacao);
end; $$;
revoke all on function pcm.sso_portal_informar_material_mediado(uuid,uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_portal_informar_material_mediado(uuid,uuid,uuid,uuid,uuid,integer,text) to authenticated;
