-- ADR-0789: conferência do catálogo sem ação sobre objeto físico.
create table pcm.sso_foto_cancelada_conferencias(
 observacao_id uuid primary key,request_id uuid not null references pcm.sso_ingestao_foto_reservas(request_id),cliente_id uuid not null references pcm.clientes(id),
 ator_id uuid not null references auth.users(id),objeto_catalogado boolean not null,observado_em timestamptz not null default now()
);
alter table pcm.sso_foto_cancelada_conferencias enable row level security;
alter table pcm.sso_foto_cancelada_conferencias force row level security;
revoke all on pcm.sso_foto_cancelada_conferencias from public,anon,authenticated,service_role;
create function pcm.sso_listar_fotos_canceladas(p_cliente_id uuid,p_lote_id uuid,p_chave text,p_apos uuid,p_limite integer)
returns table(request_id uuid,cancelada_em timestamptz,ultima_observacao_em timestamptz,objeto_catalogado boolean) language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_ingestao_foto_gate where id),false) or not coalesce((select habilitado from pcm.sso_fotos_levantamento_gate where id),false) then raise exception 'ingestao_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is not true or not exists(select 1 from pcm.sso_levantamentos l join pcm.sso_levantamento_linhas i on i.lote_id=l.id where l.id=p_lote_id and l.cliente_id=p_cliente_id and i.chave=p_chave) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 return query select r.request_id,r.cancelado_em,o.observado_em,o.objeto_catalogado from pcm.sso_ingestao_foto_reservas r left join lateral (select c.observado_em,c.objeto_catalogado from pcm.sso_foto_cancelada_conferencias c where c.request_id=r.request_id and c.cliente_id=r.cliente_id order by c.observado_em desc,c.observacao_id desc limit 1) o on true where r.cliente_id=p_cliente_id and r.lote_id=p_lote_id and r.linha_chave=p_chave and r.cancelado_em is not null and (p_apos is null or r.request_id>p_apos) order by r.request_id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_fotos_canceladas(uuid,uuid,text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_fotos_canceladas(uuid,uuid,text,uuid,integer) to authenticated;
create function pcm.sso_conferir_foto_cancelada(p_observacao_id uuid,p_cliente_id uuid,p_request_id uuid,p_lote_id uuid,p_chave text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_res pcm.sso_ingestao_foto_reservas%rowtype;v_obs pcm.sso_foto_cancelada_conferencias%rowtype;v_catalogado boolean;v_ator uuid:=auth.uid();
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not coalesce((select habilitado from pcm.sso_ingestao_foto_gate where id),false) or not coalesce((select habilitado from pcm.sso_fotos_levantamento_gate where id),false) then raise exception 'ingestao_desabilitada' using errcode='55000'; end if;
 if v_ator is null or p_cliente_id is null or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_observacao_id is null or p_request_id is null or p_lote_id is null or p_chave is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-foto-cancelada:'||p_observacao_id::text,0));
 select r.* into v_res from pcm.sso_ingestao_foto_reservas r join pcm.sso_levantamentos l on l.id=r.lote_id and l.cliente_id=r.cliente_id join pcm.sso_levantamento_linhas i on i.lote_id=r.lote_id and i.chave=r.linha_chave where r.request_id=p_request_id and r.cliente_id=p_cliente_id and r.lote_id=p_lote_id and r.linha_chave=p_chave and r.cancelado_em is not null for update of r;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select c.* into v_obs from pcm.sso_foto_cancelada_conferencias c where c.observacao_id=p_observacao_id;
 if found then
  if v_obs.ator_id is distinct from v_ator or v_obs.request_id is distinct from p_request_id or v_obs.cliente_id is distinct from p_cliente_id then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  return jsonb_build_object('observacaoId',v_obs.observacao_id,'requestId',v_obs.request_id,'objetoCatalogado',v_obs.objeto_catalogado,'observadoEm',v_obs.observado_em);
 end if;
 select exists(select 1 from storage.objects o join storage.buckets b on b.id=o.bucket_id and b.public is false where o.bucket_id='sso-levantamento-fotos' and o.name=v_res.nome) into v_catalogado;
 insert into pcm.sso_foto_cancelada_conferencias(observacao_id,request_id,cliente_id,ator_id,objeto_catalogado) values(p_observacao_id,p_request_id,p_cliente_id,v_ator,v_catalogado) returning * into v_obs;
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.foto_cancelada_conferida','sso_levantamentos',p_lote_id,jsonb_build_object('clienteId',p_cliente_id,'requestId',p_request_id,'observacaoId',p_observacao_id,'objetoCatalogado',v_catalogado));
 return jsonb_build_object('observacaoId',v_obs.observacao_id,'requestId',v_obs.request_id,'objetoCatalogado',v_obs.objeto_catalogado,'observadoEm',v_obs.observado_em);
end; $$;
revoke all on function pcm.sso_conferir_foto_cancelada(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_conferir_foto_cancelada(uuid,uuid,uuid,uuid,text) to authenticated;
