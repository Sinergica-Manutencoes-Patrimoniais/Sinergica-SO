-- ADR-1361: leitura pontual; não autoriza envio.
create function pcm.sso_t24_categoria_candidata(p_ator_id uuid,p_cliente_id uuid,p_tentativa_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_diagnostico jsonb; v_fotografia text; v_atual text;
begin
  v_diagnostico:=pcm.sso_t24_diagnosticar_candidata(p_ator_id,p_cliente_id,p_tentativa_id);
  select c.categoria, o.categoria into v_fotografia,v_atual from pcm.sso_t24_tentativas t
    join pcm.ordens_servico o on o.id=t.os_id and o.client_id=t.cliente_id and o.deleted_at is null
    left join pcm.sso_t24_categoria_reparo c on c.tentativa_id=t.id
    where t.id=p_tentativa_id and t.cliente_id=p_cliente_id;
  if not found or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then
    raise exception 'origem_indisponivel' using errcode='42501'; end if;
  return jsonb_build_object('tentativaId',p_tentativa_id,'clienteId',p_cliente_id,
    'visitaId',v_diagnostico->>'visitaId','osId',v_diagnostico->>'osId',
    'categoriaFotografada',v_fotografia,'categoriaAtual',v_atual,
    'categoriaCoincide',case when v_fotografia is null then null else v_fotografia=v_atual end,'autorizaEnvio',false);
end; $$;
revoke all on function pcm.sso_t24_categoria_candidata(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_t24_categoria_candidata(uuid,uuid,uuid) to authenticated;
