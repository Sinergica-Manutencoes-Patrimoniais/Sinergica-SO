create table pcm.sso_acesso_anexo_localizacao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_acesso_anexo_localizacao_gate(id,habilitado) values(true,false);
alter table pcm.sso_acesso_anexo_localizacao_gate enable row level security;alter table pcm.sso_acesso_anexo_localizacao_gate force row level security;
revoke all on pcm.sso_acesso_anexo_localizacao_gate from public,anon,authenticated,service_role;
create function pcm.sso_contexto_anexo_localizacao(p_tipo text,p_anexo_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;v_lote uuid;v_chave text;v_atual pcm.sso_atualizacoes_localizacao%rowtype;v_v pcm.sso_anexos_localizacao_atualizada%rowtype;v_decisao text;v_revision integer;
begin
 if not coalesce((select habilitado from pcm.sso_acesso_anexo_localizacao_gate where id),false) or not coalesce((select habilitado from pcm.sso_anexo_localizacao_atualizada_gate where id),false) then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_tipo is null or p_tipo not in ('foto','documento') or p_anexo_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if p_tipo='foto' then select f.cliente_id,f.lote_id,f.linha_chave into v_cliente,v_lote,v_chave from pcm.sso_fotos_levantamento f where f.id=p_anexo_id; select d.decisao,d.revisao into v_decisao,v_revision from pcm.sso_decisoes_foto_levantamento d where d.foto_id=p_anexo_id order by d.revisao desc limit 1;
 else select d.cliente_id,d.lote_id,d.linha_chave into v_cliente,v_lote,v_chave from pcm.sso_documentos_levantamento d where d.id=p_anexo_id; select d.decisao,d.revisao into v_decisao,v_revision from pcm.sso_decisoes_documento_levantamento d where d.documento_id=p_anexo_id order by d.revisao desc limit 1; end if;
 if v_cliente is null or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true or config.sso_autorizar_acao('cadastro.gerir',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_atual from pcm.sso_atualizacoes_localizacao where lote_id=v_lote and linha_chave=v_chave;
 select * into v_v from pcm.sso_anexos_localizacao_atualizada where tipo_anexo=p_tipo and anexo_id=p_anexo_id and cliente_id=v_cliente;
 return jsonb_build_object('tipo',p_tipo,'anexoId',p_anexo_id,'localizacaoTipo',v_atual.tipo,'entidadeId',v_atual.entidade_id,'decisao',v_decisao,'revision',coalesce(v_revision,0),'vinculado',v_v.id is not null);
end; $$;
revoke all on function pcm.sso_contexto_anexo_localizacao(text,uuid) from public,anon,authenticated,service_role;
create function pcm.sso_listar_anexos_localizacao_atualizada(p_cliente_id uuid,p_tipo_localizacao text,p_entidade_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,tipo_anexo text,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_acesso_anexo_localizacao_gate where id),false) or not coalesce((select habilitado from pcm.sso_anexo_localizacao_atualizada_gate where id),false) then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_entidade_id is null or p_tipo_localizacao is null or p_tipo_localizacao not in ('area','local','sublocal') or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if config.sso_autorizar_acao('cadastro.ler',p_cliente_id) is not true and config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not ((p_tipo_localizacao='area' and exists(select 1 from pcm.areas a where a.id=p_entidade_id and a.cliente_id=p_cliente_id and a.ativo and a.deleted_at is null)) or (p_tipo_localizacao in ('local','sublocal') and exists(select 1 from pcm.locais l join pcm.areas a on a.id=l.area_id where l.id=p_entidade_id and a.cliente_id=p_cliente_id and a.ativo and a.deleted_at is null and l.ativo and l.deleted_at is null))) then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select v.id,v.tipo_anexo,v.criado_em from pcm.sso_anexos_localizacao_atualizada v where v.cliente_id=p_cliente_id and v.tipo_localizacao=p_tipo_localizacao and v.entidade_id=p_entidade_id and (p_apos is null or v.id>p_apos) order by v.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_anexos_localizacao_atualizada(uuid,text,uuid,uuid,integer) from public,anon,authenticated,service_role;
create function pcm.sso_caminho_anexo_localizacao_atualizada(p_tipo text,p_vinculo_id uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare v pcm.sso_anexos_localizacao_atualizada%rowtype;v_nome text;v_decisao text;
begin
 if not coalesce((select habilitado from pcm.sso_acesso_anexo_localizacao_gate where id),false) or not coalesce((select habilitado from pcm.sso_anexo_localizacao_atualizada_gate where id),false) then raise exception 'acesso_desabilitado' using errcode='55000'; end if;
 if auth.uid() is null or p_vinculo_id is null or p_tipo is null or p_tipo not in ('foto','documento') then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 select * into v from pcm.sso_anexos_localizacao_atualizada where id=p_vinculo_id and tipo_anexo=p_tipo;
 if not found or (config.sso_autorizar_acao('cadastro.ler',v.cliente_id) is not true and config.sso_autorizar_acao('cadastro.gerir',v.cliente_id) is not true) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not ((v.tipo_localizacao='area' and exists(select 1 from pcm.areas a where a.id=v.entidade_id and a.cliente_id=v.cliente_id and a.ativo and a.deleted_at is null)) or (v.tipo_localizacao in ('local','sublocal') and exists(select 1 from pcm.locais l join pcm.areas a on a.id=l.area_id where l.id=v.entidade_id and a.cliente_id=v.cliente_id and a.ativo and a.deleted_at is null and l.ativo and l.deleted_at is null))) or exists(select 1 from pcm.sso_retiradas_anexo r where r.tipo=p_tipo and r.anexo_id=v.anexo_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_tipo='foto' then
   select d.decisao into v_decisao from pcm.sso_decisoes_foto_levantamento d where d.foto_id=v.anexo_id order by d.revisao desc limit 1;
   if v_decisao is distinct from 'aceita' or pcm.sso_foto_inadequada(v.anexo_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
   select o.name into v_nome from pcm.sso_fotos_levantamento f join storage.objects o on o.id=f.objeto_id and o.bucket_id='sso-levantamento-fotos' and split_part(o.name,'/',1)=v.cliente_id::text and split_part(o.name,'/',2)=v.lote_id::text join storage.buckets b on b.id=o.bucket_id and b.public is false where f.id=v.anexo_id and f.cliente_id=v.cliente_id and f.lote_id=v.lote_id and f.linha_chave=v.linha_chave;
 else
   select d.decisao into v_decisao from pcm.sso_decisoes_documento_levantamento d where d.documento_id=v.anexo_id order by d.revisao desc limit 1;
   if v_decisao is distinct from 'aceito' or pcm.sso_documento_inadequado(v.anexo_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
   select o.name into v_nome from pcm.sso_documentos_levantamento d join storage.objects o on o.id=d.objeto_id and o.bucket_id='sso-levantamento-documentos' and split_part(o.name,'/',1)=v.cliente_id::text and split_part(o.name,'/',2)=v.lote_id::text join storage.buckets b on b.id=o.bucket_id and b.public is false where d.id=v.anexo_id and d.cliente_id=v.cliente_id and d.lote_id=v.lote_id and d.linha_chave=v.linha_chave;
 end if;
 if v_nome is null then raise exception 'sem_acesso' using errcode='42501'; end if;return v_nome;
end; $$;
revoke all on function pcm.sso_caminho_anexo_localizacao_atualizada(text,uuid) from public,anon,authenticated,service_role;
