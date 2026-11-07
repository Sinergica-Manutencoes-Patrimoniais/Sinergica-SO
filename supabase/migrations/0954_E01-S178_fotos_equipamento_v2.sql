-- ADR-0728: extensão isolada; gate desligado e contratos antigos preservados.
create table pcm.sso_foto_equipamento_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_foto_equipamento_gate(id,habilitado) values(true,false);
alter table pcm.sso_foto_equipamento_gate enable row level security;
alter table pcm.sso_foto_equipamento_gate force row level security;
revoke all on pcm.sso_foto_equipamento_gate from public,anon,authenticated,service_role;
alter table pcm.sso_foto_staging_ativo drop constraint sso_foto_staging_ativo_tipo_check;
alter table pcm.sso_foto_staging_ativo add constraint sso_foto_staging_ativo_tipo_check check(tipo in ('sistema','componente','equipamento'));

create function pcm.sso_vincular_foto_staging_ativo_mediado_v2(p_request_id uuid,p_foto_id uuid,p_tipo text,p_entidade_id uuid,p_decisao_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid(); v_foto pcm.sso_fotos_levantamento%rowtype; v_anterior pcm.sso_foto_staging_ativo%rowtype; v_decisao pcm.sso_decisoes_foto_levantamento%rowtype; v_id uuid;
begin
  if p_tipo is distinct from 'equipamento' then raise exception 'tipo_invalido' using errcode='22023'; end if;
  if not coalesce((select g.habilitado from pcm.sso_foto_equipamento_gate g where g.id),false) or not coalesce((select g.habilitado from pcm.sso_foto_staging_ativo_gate g where g.id),false) then raise exception 'vinculo_desabilitado' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_foto_id is null or p_entidade_id is null or p_decisao_revision is null or p_decisao_revision<1 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('foto-staging-ativo:'||p_request_id::text,0));
  select * into v_foto from pcm.sso_fotos_levantamento where id=p_foto_id for update;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',v_foto.cliente_id) is not true or config.sso_autorizar_acao('cadastro.gerir',v_foto.cliente_id) is not true then raise exception 'foto_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  select * into v_anterior from pcm.sso_foto_staging_ativo where request_id=p_request_id;
  if found then
    if v_anterior.ator_id is distinct from v_ator or v_anterior.foto_id is distinct from p_foto_id or v_anterior.tipo is distinct from p_tipo or v_anterior.entidade_id is distinct from p_entidade_id or v_anterior.decisao_revision is distinct from p_decisao_revision then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('vinculoId',v_anterior.id,'fotoId',p_foto_id,'tipo',p_tipo,'entidadeId',p_entidade_id,'revision',p_decisao_revision,'requestId',p_request_id);
  end if;
  perform 1 from pcm.equipamentos e where e.id=p_entidade_id and e.client_id=v_foto.cliente_id and e.tipo='equipamento' and e.ativo and e.deleted_at is null for update;
  if not found or not exists(select 1 from pcm.sso_levantamento_incorporacoes i where i.lote_id=v_foto.lote_id and i.linha_chave=v_foto.linha_chave and i.tipo='equipamento' and i.entidade_id=p_entidade_id) then raise exception 'ativo_ou_incorporacao_invalida' using errcode='23514'; end if;
  -- Reconsulta após espera do lock; não serializa com revogações concorrentes posteriores.
  if config.sso_autorizar_acao('cadastro.aprovar',v_foto.cliente_id) is not true or config.sso_autorizar_acao('cadastro.gerir',v_foto.cliente_id) is not true then raise exception 'foto_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  select * into v_decisao from pcm.sso_decisoes_foto_levantamento where foto_id=p_foto_id order by revisao desc limit 1;
  if not found or v_decisao.revisao<>p_decisao_revision or v_decisao.decisao<>'aceita' then raise exception 'foto_nao_aceita_ou_decisao_obsoleta' using errcode='40001'; end if;
  insert into pcm.sso_foto_staging_ativo(foto_id,tipo,entidade_id,cliente_id,decisao_revision,ator_id,request_id) values(p_foto_id,p_tipo,p_entidade_id,v_foto.cliente_id,p_decisao_revision,v_ator,p_request_id) returning id into v_id;
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.foto_ativo_vinculada','sso_levantamentos',v_foto.lote_id,jsonb_build_object('clienteId',v_foto.cliente_id,'fotoId',p_foto_id,'vinculoId',v_id,'tipo',p_tipo,'entidadeId',p_entidade_id,'decisaoRevision',p_decisao_revision,'requestId',p_request_id));
  return jsonb_build_object('vinculoId',v_id,'fotoId',p_foto_id,'tipo',p_tipo,'entidadeId',p_entidade_id,'revision',p_decisao_revision,'requestId',p_request_id);
end; $$;
revoke all on function pcm.sso_vincular_foto_staging_ativo_mediado_v2(uuid,uuid,text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_vincular_foto_staging_ativo_mediado_v2(uuid,uuid,text,uuid,integer) to authenticated;

create function pcm.sso_listar_fotos_staging_ativo_mediado_v2(p_tipo text,p_entidade_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
  if not coalesce((select g.habilitado from pcm.sso_foto_equipamento_gate g where g.id),false) or not coalesce((select g.habilitado from pcm.sso_foto_staging_ativo_gate g where g.id),false) or not coalesce((select g.habilitado from pcm.sso_fotos_levantamento_gate g where g.id),false) then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
  if auth.uid() is null or p_tipo is distinct from 'equipamento' or p_entidade_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select e.client_id into v_cliente from pcm.equipamentos e where e.id=p_entidade_id and e.tipo='equipamento' and e.ativo and e.deleted_at is null;
  if v_cliente is null or (config.sso_autorizar_acao('cadastro.ler',v_cliente) is not true and config.sso_autorizar_acao('cadastro.gerir',v_cliente) is not true) then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select x.id,x.criado_em from pcm.sso_foto_staging_ativo x join lateral (select d.decisao from pcm.sso_decisoes_foto_levantamento d where d.foto_id=x.foto_id order by d.revisao desc limit 1) u on u.decisao='aceita' where x.tipo='equipamento' and x.entidade_id=p_entidade_id and x.cliente_id=v_cliente and not pcm.sso_foto_inadequada(x.foto_id) and not exists(select 1 from pcm.sso_retiradas_anexo r where r.tipo='foto' and r.anexo_id=x.foto_id) and (p_apos is null or x.id>p_apos) order by x.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_fotos_staging_ativo_mediado_v2(text,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_fotos_staging_ativo_mediado_v2(text,uuid,uuid,integer) to authenticated;

create function pcm.sso_consultar_destino_foto_equipamento_v2(p_foto_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_foto pcm.sso_fotos_levantamento%rowtype; v_inc pcm.sso_levantamento_incorporacoes%rowtype; v_dec pcm.sso_decisoes_foto_levantamento%rowtype; v_ativo boolean;
begin
  if not coalesce((select g.habilitado from pcm.sso_foto_equipamento_gate g where g.id),false) or not coalesce((select g.habilitado from pcm.sso_foto_staging_ativo_gate g where g.id),false) then raise exception 'vinculo_desabilitado' using errcode='55000'; end if;
  if auth.uid() is null or p_foto_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_foto from pcm.sso_fotos_levantamento where id=p_foto_id;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',v_foto.cliente_id) is not true or config.sso_autorizar_acao('cadastro.gerir',v_foto.cliente_id) is not true then raise exception 'foto_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  select * into v_inc from pcm.sso_levantamento_incorporacoes where lote_id=v_foto.lote_id and linha_chave=v_foto.linha_chave and tipo='equipamento';
  select * into v_dec from pcm.sso_decisoes_foto_levantamento where foto_id=p_foto_id order by revisao desc limit 1;
  if v_inc.entidade_id is not null then select exists(select 1 from pcm.equipamentos e where e.id=v_inc.entidade_id and e.client_id=v_foto.cliente_id and e.tipo='equipamento' and e.ativo and e.deleted_at is null) into v_ativo; end if;
  return jsonb_build_object('fotoId',p_foto_id,'tipo',v_inc.tipo,'entidadeId',v_inc.entidade_id,'decisao',v_dec.decisao,'revision',coalesce(v_dec.revisao,0),'vinculado',exists(select 1 from pcm.sso_foto_staging_ativo x where x.foto_id=p_foto_id),'fotoInadequada',pcm.sso_foto_inadequada(p_foto_id),'destinoAtivo',v_ativo);
end; $$;
revoke all on function pcm.sso_consultar_destino_foto_equipamento_v2(uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_destino_foto_equipamento_v2(uuid) to authenticated;

create function pcm.sso_caminho_foto_equipamento_interno_v2(p_vinculo_id uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare v_caminho text;
begin
  if auth.uid() is null or not coalesce((select g.habilitado from pcm.sso_foto_equipamento_gate g where g.id),false) or not coalesce((select g.habilitado from pcm.sso_foto_staging_ativo_gate g where g.id),false) or not coalesce((select g.habilitado from pcm.sso_fotos_levantamento_gate g where g.id),false) then raise exception 'foto_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  select o.name into v_caminho from pcm.sso_foto_staging_ativo x
  join pcm.sso_fotos_levantamento f on f.id=x.foto_id and f.cliente_id=x.cliente_id
  join pcm.equipamentos e on e.id=x.entidade_id and e.client_id=x.cliente_id and e.tipo='equipamento' and e.ativo and e.deleted_at is null
  join storage.objects o on o.id=f.objeto_id and o.bucket_id='sso-levantamento-fotos'
  join storage.buckets b on b.id=o.bucket_id and b.public is false
  join lateral (select d.decisao from pcm.sso_decisoes_foto_levantamento d where d.foto_id=f.id order by d.revisao desc limit 1) u on u.decisao='aceita'
  where x.id=p_vinculo_id and x.tipo='equipamento' and not pcm.sso_foto_inadequada(f.id)
    and not exists(select 1 from pcm.sso_retiradas_anexo r where r.tipo='foto' and r.anexo_id=f.id)
    and (config.sso_autorizar_acao('cadastro.ler',x.cliente_id) is true or config.sso_autorizar_acao('cadastro.gerir',x.cliente_id) is true);
  if v_caminho is null then raise exception 'foto_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  return v_caminho;
end; $$;
revoke all on function pcm.sso_caminho_foto_equipamento_interno_v2(uuid) from public,anon,authenticated,service_role;

create function pcm.sso_caminho_foto_equipamento_servico_v2(p_vinculo_id uuid,p_usuario_id uuid,p_user_role text)
returns text language plpgsql security definer set search_path='' as $$
declare v_claims text; v_sub text; v_caminho text;
begin
  if p_vinculo_id is null or p_usuario_id is null or p_user_role is null or length(p_user_role) not between 1 and 100 then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_claims:=current_setting('request.jwt.claims',true); v_sub:=current_setting('request.jwt.claim.sub',true);
  perform pg_catalog.set_config('request.jwt.claims',jsonb_build_object('sub',p_usuario_id::text,'user_role',p_user_role)::text,true);
  perform pg_catalog.set_config('request.jwt.claim.sub',p_usuario_id::text,true);
  v_caminho:=pcm.sso_caminho_foto_equipamento_interno_v2(p_vinculo_id);
  perform pg_catalog.set_config('request.jwt.claims',coalesce(v_claims,''),true);
  perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
  return v_caminho;
end; $$;
revoke all on function pcm.sso_caminho_foto_equipamento_servico_v2(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_caminho_foto_equipamento_servico_v2(uuid,uuid,text) to service_role;
