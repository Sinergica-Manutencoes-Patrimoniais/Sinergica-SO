-- ADR-0780: projeção autorizada sem nomes de objeto nem digest.
create function pcm.sso_consultar_observacao_ingestao_foto(p_cliente_id uuid,p_request_id uuid,p_lote_id uuid,p_chave text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_res pcm.sso_ingestao_foto_reservas%rowtype;v_obs pcm.sso_ingestao_foto_observacoes%rowtype;v_observacao jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_ingestao_foto_gate where id),false) or not coalesce((select habilitado from pcm.sso_fotos_levantamento_gate where id),false) then raise exception 'ingestao_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_request_id is null or p_lote_id is null or p_chave is null or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select r.* into v_res from pcm.sso_ingestao_foto_reservas r join pcm.sso_levantamentos l on l.id=r.lote_id and l.cliente_id=r.cliente_id join pcm.sso_levantamento_linhas i on i.lote_id=r.lote_id and i.chave=r.linha_chave where r.request_id=p_request_id and r.cliente_id=p_cliente_id and r.lote_id=p_lote_id and r.linha_chave=p_chave;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 select o.* into v_obs from pcm.sso_ingestao_foto_observacoes o where o.request_id=v_res.request_id and o.cliente_id=v_res.cliente_id;
 if found then v_observacao:=jsonb_build_object('observadoEm',v_obs.observado_em,'objetoCatalogado',v_obs.objeto_catalogado,'confirmada',v_obs.confirmada); end if;
 return jsonb_build_object('requestId',v_res.request_id,'confirmada',v_res.foto_id is not null,'observacao',v_observacao);
end; $$;
revoke all on function pcm.sso_consultar_observacao_ingestao_foto(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_observacao_ingestao_foto(uuid,uuid,uuid,text) to authenticated;
