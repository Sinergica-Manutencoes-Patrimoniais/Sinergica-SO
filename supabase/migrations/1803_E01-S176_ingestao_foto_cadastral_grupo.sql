-- ADR-1661: reserva privada e confirmação com digest; sem upload direto autenticado.
create table pcm.sso_ingestao_foto_cadastral_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_ingestao_foto_cadastral_grupo_gate(id,habilitado) values(true,false);
alter table pcm.sso_ingestao_foto_cadastral_grupo_gate enable row level security;
alter table pcm.sso_ingestao_foto_cadastral_grupo_gate force row level security;
revoke all on pcm.sso_ingestao_foto_cadastral_grupo_gate from public,anon,authenticated,service_role;

create table pcm.sso_ingestao_foto_cadastral_grupo_reservas(
 request_id uuid primary key, ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),
 grupo_id uuid not null references pcm.grupos_quantitativos(id),digest text not null check(digest ~ '^[a-f0-9]{64}$'),
 tipo text not null check(tipo in ('image/jpeg','image/png')),nome text not null unique,
 objeto_id uuid unique,foto_id uuid unique references pcm.sso_grupo_fotos(id),criado_em timestamptz not null default now(),confirmado_em timestamptz,
 check((objeto_id is null and foto_id is null and confirmado_em is null) or (objeto_id is not null and foto_id is not null and confirmado_em is not null))
);
alter table pcm.sso_ingestao_foto_cadastral_grupo_reservas enable row level security;
alter table pcm.sso_ingestao_foto_cadastral_grupo_reservas force row level security;
revoke all on pcm.sso_ingestao_foto_cadastral_grupo_reservas from public,anon,authenticated,service_role;

create function pcm.sso_ingestao_foto_cadastral_grupo_servico(
 p_operacao text,p_ator uuid,p_papel text,p_cliente uuid,p_grupo uuid,p_request uuid,p_digest text,p_tipo text,p_objeto uuid
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_papel text;v_claims text;v_sub text;v_res pcm.sso_ingestao_foto_cadastral_grupo_reservas%rowtype;v_obj uuid;v_foto uuid;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if p_operacao is null or p_operacao not in ('reservar','recuperar','confirmar') or p_ator is null or p_papel is null or p_papel='' or p_cliente is null or p_grupo is null or p_request is null or p_digest is null or p_digest !~ '^[a-f0-9]{64}$' or p_tipo is null or p_tipo not in ('image/jpeg','image/png') then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_ingestao_foto_cadastral_grupo_gate where id and habilitado for share;
 if not found then raise exception 'ingestao_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_grupo_fotos_gate where id and habilitado for share;
 if not found then raise exception 'ingestao_desabilitada' using errcode='55000'; end if;
 select u.papel into v_papel from config.usuarios u where u.user_id=p_ator and u.ativo;
 if v_papel is null or v_papel is distinct from p_papel then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_claims:=current_setting('request.jwt.claims',true);v_sub:=current_setting('request.jwt.claim.sub',true);
 perform pg_catalog.set_config('request.jwt.claims',jsonb_build_object('sub',p_ator::text,'user_role',p_papel)::text,true);
 perform pg_catalog.set_config('request.jwt.claim.sub',p_ator::text,true);
 if config.sso_autorizar_acao('cadastro.gerir',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.grupos_quantitativos g where g.id=p_grupo and g.cliente_id=p_cliente and g.ativo and g.deleted_at is null for share;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-foto-cadastral-grupo:'||p_request::text,0));
 select * into v_res from pcm.sso_ingestao_foto_cadastral_grupo_reservas where request_id=p_request for update;
 if not found then
  if p_operacao<>'reservar' then raise exception 'reserva_indisponivel' using errcode='42501'; end if;
  insert into pcm.sso_ingestao_foto_cadastral_grupo_reservas(request_id,ator_id,cliente_id,grupo_id,digest,tipo,nome)
   values(p_request,p_ator,p_cliente,p_grupo,p_digest,p_tipo,p_cliente::text||'/'||p_grupo::text||'/'||gen_random_uuid()::text) returning * into v_res;
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator,'grupo.foto_reservada','grupos_quantitativos',p_grupo,jsonb_build_object('requestId',p_request,'clienteId',p_cliente));
 end if;
 if v_res.ator_id is distinct from p_ator or v_res.cliente_id is distinct from p_cliente or v_res.grupo_id is distinct from p_grupo or v_res.digest is distinct from p_digest or v_res.tipo is distinct from p_tipo then raise exception 'request_id_conflitante' using errcode='23505'; end if;
 if v_res.foto_id is not null then
  if p_operacao='confirmar' and p_objeto is distinct from v_res.objeto_id then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  perform pg_catalog.set_config('request.jwt.claims',coalesce(v_claims,''),true);perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
  return jsonb_build_object('estado','concluida','fotoId',v_res.foto_id,'requestId',p_request);
 end if;
 if p_operacao='reservar' then
  perform pg_catalog.set_config('request.jwt.claims',coalesce(v_claims,''),true);perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
  return jsonb_build_object('estado','pendente','nome',v_res.nome);
 end if;
 select o.id into v_obj from storage.objects o join storage.buckets b on b.id=o.bucket_id and b.public is false
  where o.bucket_id='sso-grupos-fotos' and o.name=v_res.nome for key share of o;
 if p_operacao='recuperar' then
  perform pg_catalog.set_config('request.jwt.claims',coalesce(v_claims,''),true);perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
  return case when v_obj is null then null else jsonb_build_object('objetoId',v_obj,'nome',v_res.nome) end;
 end if;
 if v_obj is null or v_obj is distinct from p_objeto then raise exception 'objeto_indisponivel' using errcode='23514'; end if;
 insert into pcm.sso_grupo_fotos(grupo_id,cliente_id,objeto_id,criado_por) values(p_grupo,p_cliente,v_obj,p_ator) returning id into v_foto;
 update pcm.sso_ingestao_foto_cadastral_grupo_reservas set objeto_id=v_obj,foto_id=v_foto,confirmado_em=clock_timestamp() where request_id=p_request;
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator,'grupo.foto_vinculada','grupos_quantitativos',p_grupo,jsonb_build_object('requestId',p_request,'clienteId',p_cliente,'fotoId',v_foto));
 perform pg_catalog.set_config('request.jwt.claims',coalesce(v_claims,''),true);perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
 return jsonb_build_object('estado','concluida','fotoId',v_foto,'requestId',p_request);
end; $$;
revoke all on function pcm.sso_ingestao_foto_cadastral_grupo_servico(text,uuid,text,uuid,uuid,uuid,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_ingestao_foto_cadastral_grupo_servico(text,uuid,text,uuid,uuid,uuid,text,text,uuid) to service_role;

-- Digest só existe para ingestões confirmadas neste protocolo; fotos anteriores não recebem digest inventado.
create function pcm.sso_resolver_foto_cadastral_grupo_verificada_servico(p_ator uuid,p_cliente uuid,p_grupo uuid,p_foto uuid,p_papel text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_obj jsonb;v_res pcm.sso_ingestao_foto_cadastral_grupo_reservas%rowtype;
begin
 v_obj:=pcm.sso_resolver_foto_cadastral_grupo_servico(p_ator,p_cliente,p_grupo,p_foto,p_papel);
 select * into v_res from pcm.sso_ingestao_foto_cadastral_grupo_reservas r where r.foto_id=p_foto;
 if found then
  if v_res.cliente_id is distinct from p_cliente or v_res.grupo_id is distinct from p_grupo or v_res.objeto_id::text is distinct from v_obj->>'objetoId' or v_res.confirmado_em is null then raise exception 'integridade_foto_divergente' using errcode='23514'; end if;
  return v_obj||jsonb_build_object('digest',v_res.digest,'verificada',true);
 end if;
 return v_obj||jsonb_build_object('digest',null,'verificada',false);
end; $$;
revoke all on function pcm.sso_resolver_foto_cadastral_grupo_verificada_servico(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_resolver_foto_cadastral_grupo_verificada_servico(uuid,uuid,uuid,uuid,text) to service_role;

create function pcm.sso_listar_fotos_cadastrais_grupo_v2(p_ator uuid,p_cliente uuid,p_grupo uuid,p_apos uuid,p_limite integer)
returns table(id uuid,criado_em timestamptz,verificada boolean) language sql volatile security definer set search_path='' as $$
 select f.id,f.criado_em,exists(select 1 from pcm.sso_ingestao_foto_cadastral_grupo_reservas r where r.foto_id=f.id and r.cliente_id=p_cliente and r.grupo_id=p_grupo and r.confirmado_em is not null)
 from pcm.sso_listar_fotos_cadastrais_grupo(p_ator,p_cliente,p_grupo,p_apos,p_limite) f;
$$;
revoke all on function pcm.sso_listar_fotos_cadastrais_grupo_v2(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_fotos_cadastrais_grupo_v2(uuid,uuid,uuid,uuid,integer) to authenticated;
