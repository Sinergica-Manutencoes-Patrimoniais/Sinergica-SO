-- ADR-0777: observação histórica, sem ação sobre Storage ou confirmação.
create table pcm.sso_ingestao_foto_observacoes(
 request_id uuid primary key references pcm.sso_ingestao_foto_reservas(request_id),
 ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),
 objeto_catalogado boolean not null,confirmada boolean not null,observado_em timestamptz not null default now()
);
alter table pcm.sso_ingestao_foto_observacoes enable row level security;
alter table pcm.sso_ingestao_foto_observacoes force row level security;
revoke all on pcm.sso_ingestao_foto_observacoes from public,anon,authenticated,service_role;
create function pcm.sso_observar_ingestao_pendente_servico(p_usuario_id uuid,p_request_id uuid,p_lote_id uuid,p_chave text,p_digest text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_res pcm.sso_ingestao_foto_reservas%rowtype;v_novo uuid;v_catalogado boolean;
begin
 perform pcm.sso_ingestao_foto_servico('autorizar',p_usuario_id,null,p_lote_id,p_chave,null,null);
 select r.* into v_res from pcm.sso_ingestao_foto_reservas r where r.request_id=p_request_id and r.ator_id=p_usuario_id and r.lote_id=p_lote_id and r.linha_chave=p_chave and r.digest=p_digest for update;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 select exists(select 1 from storage.objects o join storage.buckets b on b.id=o.bucket_id and b.public is false where o.bucket_id='sso-levantamento-fotos' and o.name=v_res.nome) into v_catalogado;
 insert into pcm.sso_ingestao_foto_observacoes(request_id,ator_id,cliente_id,objeto_catalogado,confirmada) values(p_request_id,p_usuario_id,v_res.cliente_id,v_catalogado,v_res.foto_id is not null)
 on conflict(request_id) do nothing returning request_id into v_novo;
 if v_novo is not null then
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_usuario_id,'levantamento.ingestao_foto_observada','sso_levantamentos',p_lote_id,jsonb_build_object('clienteId',v_res.cliente_id,'requestId',p_request_id,'objetoCatalogado',v_catalogado,'confirmada',v_res.foto_id is not null));
 end if;
 return jsonb_build_object('registrado',true);
end; $$;
revoke all on function pcm.sso_observar_ingestao_pendente_servico(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_observar_ingestao_pendente_servico(uuid,uuid,uuid,text,text) to service_role;
