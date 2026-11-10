-- ADR-0740: mediação e consulta de recibo, sem conceder núcleo ou Storage ao navegador.
create function pcm.sso_vincular_foto_levantamento_autorizado(p_request_id uuid,p_lote_id uuid,p_chave text,p_nome text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_cliente uuid;
begin
  if not coalesce((select g.habilitado from pcm.sso_mediacao_conferencia_gate g where g.id),false) or not coalesce((select g.habilitado from pcm.sso_fotos_levantamento_gate g where g.id),false) then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
  if auth.uid() is null or p_lote_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
  select l.cliente_id into v_cliente from pcm.sso_levantamentos l where l.id=p_lote_id;
  if v_cliente is null or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return pcm.sso_vincular_foto_levantamento(p_request_id,p_lote_id,p_chave,p_nome);
end; $$;
revoke all on function pcm.sso_vincular_foto_levantamento_autorizado(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_vincular_foto_levantamento_autorizado(uuid,uuid,text,text) to authenticated;

create function pcm.sso_recibo_foto_levantamento_autorizado(p_request_id uuid,p_lote_id uuid,p_chave text,p_nome text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid; v_foto uuid;
begin
  if not coalesce((select g.habilitado from pcm.sso_mediacao_conferencia_gate g where g.id),false) or not coalesce((select g.habilitado from pcm.sso_fotos_levantamento_gate g where g.id),false) then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
  if auth.uid() is null or p_request_id is null or p_lote_id is null or p_chave is null or p_nome is null then raise exception 'sem_acesso' using errcode='42501'; end if;
  select l.cliente_id into v_cliente from pcm.sso_levantamentos l where l.id=p_lote_id;
  if v_cliente is null or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select f.id into v_foto from pcm.sso_fotos_levantamento f join storage.objects o on o.id=f.objeto_id and o.bucket_id='sso-levantamento-fotos'
    where f.request_id=p_request_id and f.ator_id=auth.uid() and f.cliente_id=v_cliente and f.lote_id=p_lote_id and f.linha_chave=p_chave and o.name=p_nome;
  if v_foto is null then return null; end if;
  return jsonb_build_object('fotoId',v_foto,'loteId',p_lote_id,'chave',p_chave,'requestId',p_request_id);
end; $$;
revoke all on function pcm.sso_recibo_foto_levantamento_autorizado(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_recibo_foto_levantamento_autorizado(uuid,uuid,text,text) to authenticated;
