-- ADR-0761: preparação interna; sem concessão a clientes ou serviço.
create table pcm.sso_ingestao_foto_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_ingestao_foto_gate(id,habilitado) values(true,false);
create table pcm.sso_ingestao_foto_reservas(
  request_id uuid primary key, ator_id uuid not null references auth.users(id), cliente_id uuid not null references pcm.clientes(id),
  lote_id uuid not null, linha_chave text not null, digest text not null check(digest ~ '^[a-f0-9]{64}$'),
  nome text not null unique, foto_id uuid unique references pcm.sso_fotos_levantamento(id),
  objeto_id uuid unique, criado_em timestamptz not null default now(), confirmado_em timestamptz,
  foreign key(lote_id,linha_chave) references pcm.sso_levantamento_linhas(lote_id,chave),
  check ((foto_id is null and objeto_id is null and confirmado_em is null) or (foto_id is not null and objeto_id is not null and confirmado_em is not null))
);
alter table pcm.sso_ingestao_foto_gate enable row level security;
alter table pcm.sso_ingestao_foto_gate force row level security;
alter table pcm.sso_ingestao_foto_reservas enable row level security;
alter table pcm.sso_ingestao_foto_reservas force row level security;
revoke all on pcm.sso_ingestao_foto_gate,pcm.sso_ingestao_foto_reservas from public,anon,authenticated,service_role;

create function pcm.sso_reservar_ingestao_foto_interno(p_request_id uuid,p_lote_id uuid,p_chave text,p_digest text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_cliente uuid;v_ant pcm.sso_ingestao_foto_reservas%rowtype;v_nome text;
begin
  if not coalesce((select g.habilitado from pcm.sso_ingestao_foto_gate g where g.id),false) or not coalesce((select g.habilitado from pcm.sso_fotos_levantamento_gate g where g.id),false) then raise exception 'ingestao_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_lote_id is null or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or p_digest is null or p_digest !~ '^[a-f0-9]{64}$' then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-ingestao-foto:'||p_request_id::text,0));
  select l.cliente_id into v_cliente from pcm.sso_levantamentos l where l.id=p_lote_id for update;
  if v_cliente is null or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_ant from pcm.sso_ingestao_foto_reservas where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from v_ator or v_ant.cliente_id is distinct from v_cliente or v_ant.lote_id is distinct from p_lote_id or v_ant.linha_chave is distinct from p_chave or v_ant.digest is distinct from p_digest then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('estado',case when v_ant.foto_id is null then 'pendente' else 'concluida' end,'digest',v_ant.digest,'nome',v_ant.nome,'fotoId',v_ant.foto_id,'requestId',p_request_id);
  end if;
  if not exists(select 1 from pcm.sso_levantamento_linhas l where l.lote_id=p_lote_id and l.chave=p_chave) then raise exception 'linha_indisponivel' using errcode='23514'; end if;
  v_nome:=v_cliente::text||'/'||p_lote_id::text||'/'||gen_random_uuid()::text;
  insert into pcm.sso_ingestao_foto_reservas(request_id,ator_id,cliente_id,lote_id,linha_chave,digest,nome) values(p_request_id,v_ator,v_cliente,p_lote_id,p_chave,p_digest,v_nome);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.ingestao_foto_reservada','sso_levantamentos',p_lote_id,jsonb_build_object('clienteId',v_cliente,'linhaChave',p_chave,'requestId',p_request_id));
  return jsonb_build_object('estado','nova','digest',p_digest,'nome',v_nome,'fotoId',null,'requestId',p_request_id);
end; $$;
revoke all on function pcm.sso_reservar_ingestao_foto_interno(uuid,uuid,text,text) from public,anon,authenticated,service_role;

create function pcm.sso_confirmar_ingestao_foto_interno(p_request_id uuid,p_digest text,p_objeto_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_res pcm.sso_ingestao_foto_reservas%rowtype;v_foto uuid;
begin
  if not coalesce((select g.habilitado from pcm.sso_ingestao_foto_gate g where g.id),false) or not coalesce((select g.habilitado from pcm.sso_fotos_levantamento_gate g where g.id),false) then raise exception 'ingestao_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_objeto_id is null or p_digest is null or p_digest !~ '^[a-f0-9]{64}$' then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-ingestao-foto:'||p_request_id::text,0));
  select * into v_res from pcm.sso_ingestao_foto_reservas where request_id=p_request_id for update;
  if not found or v_res.ator_id is distinct from v_ator or config.sso_autorizar_acao('cadastro.aprovar',v_res.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if v_res.digest is distinct from p_digest then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  if v_res.foto_id is not null then
    if v_res.objeto_id is distinct from p_objeto_id then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('fotoId',v_res.foto_id,'requestId',p_request_id);
  end if;
  if not exists(select 1 from pcm.sso_levantamentos l join pcm.sso_levantamento_linhas i on i.lote_id=l.id where l.id=v_res.lote_id and l.cliente_id=v_res.cliente_id and i.chave=v_res.linha_chave) then raise exception 'linha_indisponivel' using errcode='23514'; end if;
  perform 1 from storage.objects o join storage.buckets b on b.id=o.bucket_id where o.id=p_objeto_id and o.bucket_id='sso-levantamento-fotos' and o.name=v_res.nome and b.public is false for key share of o;
  if not found then raise exception 'objeto_indisponivel' using errcode='23514'; end if;
  insert into pcm.sso_fotos_levantamento(cliente_id,lote_id,linha_chave,objeto_id,ator_id,request_id) values(v_res.cliente_id,v_res.lote_id,v_res.linha_chave,p_objeto_id,v_ator,p_request_id) returning id into v_foto;
  update pcm.sso_ingestao_foto_reservas set foto_id=v_foto,objeto_id=p_objeto_id,confirmado_em=now() where request_id=p_request_id;
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.ingestao_foto_confirmada','sso_levantamentos',v_res.lote_id,jsonb_build_object('clienteId',v_res.cliente_id,'linhaChave',v_res.linha_chave,'requestId',p_request_id,'fotoId',v_foto));
  return jsonb_build_object('fotoId',v_foto,'requestId',p_request_id);
end; $$;
revoke all on function pcm.sso_confirmar_ingestao_foto_interno(uuid,text,uuid) from public,anon,authenticated,service_role;
