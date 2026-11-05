-- ADR-0305: decisão individual, privada e desligada.
create table pcm.sso_decisao_foto_levantamento_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_decisao_foto_levantamento_gate(id,habilitado) values(true,false);
create table pcm.sso_decisoes_foto_levantamento(id uuid primary key default gen_random_uuid(),foto_id uuid not null references pcm.sso_fotos_levantamento(id),revisao integer not null check(revisao>0),decisao text not null check(decisao in ('aceita','rejeitada')),motivo text not null check(length(btrim(motivo)) between 1 and 2000),ator_id uuid not null references auth.users(id),request_id uuid not null unique,criado_em timestamptz not null default now(),unique(foto_id,revisao));
alter table pcm.sso_decisao_foto_levantamento_gate enable row level security;alter table pcm.sso_decisao_foto_levantamento_gate force row level security;
alter table pcm.sso_decisoes_foto_levantamento enable row level security;alter table pcm.sso_decisoes_foto_levantamento force row level security;
revoke all on pcm.sso_decisao_foto_levantamento_gate,pcm.sso_decisoes_foto_levantamento from public,anon,authenticated,service_role;
create function pcm.sso_decisao_foto_imutavel() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'historico_imutavel' using errcode='23514'; end; $$;
revoke all on function pcm.sso_decisao_foto_imutavel() from public,anon,authenticated,service_role;
create trigger sso_decisao_foto_imutavel before update or delete on pcm.sso_decisoes_foto_levantamento for each row execute function pcm.sso_decisao_foto_imutavel();
create function pcm.sso_decidir_foto_levantamento(p_request_id uuid,p_foto_id uuid,p_expected_revision integer,p_decisao text,p_motivo text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_foto pcm.sso_fotos_levantamento%rowtype;v_anterior pcm.sso_decisoes_foto_levantamento%rowtype;v_id uuid;v_revisao integer;
begin
  if not coalesce((select habilitado from pcm.sso_decisao_foto_levantamento_gate where id),false) then raise exception 'decisao_foto_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_foto_id is null or p_expected_revision is null or p_expected_revision<0 or p_decisao is null or p_decisao not in ('aceita','rejeitada') or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('decisao-foto:'||p_request_id::text,0));
  select * into v_foto from pcm.sso_fotos_levantamento where id=p_foto_id for update;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',v_foto.cliente_id) is not true then raise exception 'foto_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  select * into v_anterior from pcm.sso_decisoes_foto_levantamento where request_id=p_request_id;
  if found then
    if v_anterior.foto_id is distinct from p_foto_id or v_anterior.ator_id is distinct from v_ator or v_anterior.revisao<>p_expected_revision+1 or v_anterior.decisao is distinct from p_decisao or v_anterior.motivo is distinct from btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('fotoId',p_foto_id,'revision',v_anterior.revisao,'decisao',v_anterior.decisao,'requestId',p_request_id);
  end if;
  select coalesce(max(revisao),0) into v_revisao from pcm.sso_decisoes_foto_levantamento where foto_id=p_foto_id;
  if v_revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  insert into pcm.sso_decisoes_foto_levantamento(foto_id,revisao,decisao,motivo,ator_id,request_id) values(p_foto_id,v_revisao+1,p_decisao,btrim(p_motivo),v_ator,p_request_id) returning id into v_id;
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.foto_decidida','sso_levantamentos',v_foto.lote_id,jsonb_build_object('clienteId',v_foto.cliente_id,'fotoId',p_foto_id,'decisaoId',v_id,'revisao',v_revisao+1,'decisao',p_decisao,'motivo',btrim(p_motivo),'requestId',p_request_id));
  return jsonb_build_object('fotoId',p_foto_id,'revision',v_revisao+1,'decisao',p_decisao,'requestId',p_request_id);
end;
$$;
revoke all on function pcm.sso_decidir_foto_levantamento(uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
create function pcm.sso_listar_decisoes_foto_levantamento(p_foto_id uuid,p_apos integer,p_limite integer)
returns table(revisao integer,decisao text,motivo text,ator_id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
  if not coalesce((select habilitado from pcm.sso_decisao_foto_levantamento_gate where id),false) then raise exception 'decisao_foto_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_foto_id is null or p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<0) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select f.cliente_id into v_cliente from pcm.sso_fotos_levantamento f where f.id=p_foto_id;
  if v_cliente is null or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select d.revisao,d.decisao,d.motivo,d.ator_id,d.criado_em from pcm.sso_decisoes_foto_levantamento d where d.foto_id=p_foto_id and (p_apos is null or d.revisao>p_apos) order by d.revisao limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_decisoes_foto_levantamento(uuid,integer,integer) from public,anon,authenticated,service_role;
