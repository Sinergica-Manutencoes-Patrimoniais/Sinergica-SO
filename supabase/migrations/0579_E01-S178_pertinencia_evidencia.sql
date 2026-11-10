-- ADR-0353: revisão humana privada, independente de publicação.
create table pcm.sso_pertinencia_evidencia_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_pertinencia_evidencia_gate(id,habilitado) values(true,false);
create table pcm.sso_pertinencia_evidencia(id uuid primary key default gen_random_uuid(),tipo text not null check(tipo in ('foto','documento')),anexo_id uuid not null,cliente_id uuid not null references pcm.clientes(id),lote_id uuid not null references pcm.sso_levantamentos(id),linha_chave text not null,edicao_revision integer not null check(edicao_revision>0),revisao integer not null check(revisao>0),decisao text not null check(decisao in ('pertinente','nao_pertinente')),motivo text not null check(length(btrim(motivo)) between 1 and 2000),ator_id uuid not null references auth.users(id),request_id uuid not null unique,criado_em timestamptz not null default now(),unique(tipo,anexo_id,revisao));
alter table pcm.sso_pertinencia_evidencia_gate enable row level security;alter table pcm.sso_pertinencia_evidencia_gate force row level security;
alter table pcm.sso_pertinencia_evidencia enable row level security;alter table pcm.sso_pertinencia_evidencia force row level security;
revoke all on pcm.sso_pertinencia_evidencia_gate,pcm.sso_pertinencia_evidencia from public,anon,authenticated,service_role;
create function pcm.sso_pertinencia_evidencia_imutavel() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'historico_imutavel' using errcode='23514'; end; $$;
revoke all on function pcm.sso_pertinencia_evidencia_imutavel() from public,anon,authenticated,service_role;
create trigger sso_pertinencia_evidencia_imutavel before update or delete on pcm.sso_pertinencia_evidencia for each row execute function pcm.sso_pertinencia_evidencia_imutavel();
create function pcm.sso_revisar_pertinencia_evidencia(p_request_id uuid,p_tipo text,p_anexo_id uuid,p_expected_revision integer,p_edicao_revision integer,p_decisao text,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_cliente uuid;v_lote uuid;v_chave text;v_ant pcm.sso_pertinencia_evidencia%rowtype;v_rev integer;v_edicao integer;
begin
  if not coalesce((select habilitado from pcm.sso_pertinencia_evidencia_gate where id),false) then raise exception 'pertinencia_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_tipo is null or p_tipo not in ('foto','documento') or p_anexo_id is null or p_expected_revision is null or p_expected_revision<0 or p_edicao_revision is null or p_edicao_revision<1 or p_decisao is null or p_decisao not in ('pertinente','nao_pertinente') or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pertinencia-evidencia:'||p_request_id::text,0));
  if p_tipo='foto' then select f.cliente_id,f.lote_id,f.linha_chave into v_cliente,v_lote,v_chave from pcm.sso_fotos_levantamento f where f.id=p_anexo_id;
  else select d.cliente_id,d.lote_id,d.linha_chave into v_cliente,v_lote,v_chave from pcm.sso_documentos_levantamento d where d.id=p_anexo_id; end if;
  if v_cliente is null or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from pcm.sso_levantamentos where id=v_lote and cliente_id=v_cliente for update;
  if not found then raise exception 'lote_indisponivel' using errcode='42501'; end if;
  if p_tipo='foto' then perform 1 from pcm.sso_fotos_levantamento where id=p_anexo_id and lote_id=v_lote for update;
  else perform 1 from pcm.sso_documentos_levantamento where id=p_anexo_id and lote_id=v_lote for update; end if;
  if not found or exists(select 1 from pcm.sso_retiradas_anexo where tipo=p_tipo and anexo_id=p_anexo_id) then raise exception 'anexo_indisponivel' using errcode='23514'; end if;
  select * into v_ant from pcm.sso_pertinencia_evidencia where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from v_ator or v_ant.tipo is distinct from p_tipo or v_ant.anexo_id is distinct from p_anexo_id or v_ant.revisao<>p_expected_revision+1 or v_ant.edicao_revision<>p_edicao_revision or v_ant.decisao is distinct from p_decisao or v_ant.motivo is distinct from btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('tipo',p_tipo,'anexoId',p_anexo_id,'revision',v_ant.revisao,'edicaoRevision',v_ant.edicao_revision,'decisao',v_ant.decisao,'requestId',p_request_id);
  end if;
  select coalesce(max(revisao),0) into v_rev from pcm.sso_pertinencia_evidencia where tipo=p_tipo and anexo_id=p_anexo_id;
  select max(revisao) into v_edicao from pcm.sso_edicoes_linha_staging where lote_id=v_lote and linha_chave=v_chave;
  if v_rev<>p_expected_revision or v_edicao is distinct from p_edicao_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  insert into pcm.sso_pertinencia_evidencia(tipo,anexo_id,cliente_id,lote_id,linha_chave,edicao_revision,revisao,decisao,motivo,ator_id,request_id) values(p_tipo,p_anexo_id,v_cliente,v_lote,v_chave,p_edicao_revision,v_rev+1,p_decisao,btrim(p_motivo),v_ator,p_request_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.evidencia_pertinencia','sso_levantamentos',v_lote,jsonb_build_object('clienteId',v_cliente,'tipo',p_tipo,'anexoId',p_anexo_id,'edicaoRevision',p_edicao_revision,'revision',v_rev+1,'decisao',p_decisao,'motivo',btrim(p_motivo),'requestId',p_request_id));
  return jsonb_build_object('tipo',p_tipo,'anexoId',p_anexo_id,'revision',v_rev+1,'edicaoRevision',p_edicao_revision,'decisao',p_decisao,'requestId',p_request_id);
end;
$$;
revoke all on function pcm.sso_revisar_pertinencia_evidencia(uuid,text,uuid,integer,integer,text,text) from public,anon,authenticated,service_role;
create function pcm.sso_consultar_pertinencia_evidencia(p_tipo text,p_anexo_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;v_lote uuid;v_chave text;v_edicao integer;v_ant pcm.sso_pertinencia_evidencia%rowtype;
begin
  if not coalesce((select habilitado from pcm.sso_pertinencia_evidencia_gate where id),false) then raise exception 'pertinencia_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_tipo is null or p_tipo not in ('foto','documento') or p_anexo_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if p_tipo='foto' then select f.cliente_id,f.lote_id,f.linha_chave into v_cliente,v_lote,v_chave from pcm.sso_fotos_levantamento f where f.id=p_anexo_id;
  else select d.cliente_id,d.lote_id,d.linha_chave into v_cliente,v_lote,v_chave from pcm.sso_documentos_levantamento d where d.id=p_anexo_id; end if;
  if v_cliente is null or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select max(revisao) into v_edicao from pcm.sso_edicoes_linha_staging where lote_id=v_lote and linha_chave=v_chave;
  select * into v_ant from pcm.sso_pertinencia_evidencia where tipo=p_tipo and anexo_id=p_anexo_id order by revisao desc limit 1;
  return jsonb_build_object('tipo',p_tipo,'anexoId',p_anexo_id,'edicaoAtual',v_edicao,'revision',coalesce(v_ant.revisao,0),'edicaoRevisada',v_ant.edicao_revision,'decisao',v_ant.decisao);
end;
$$;
revoke all on function pcm.sso_consultar_pertinencia_evidencia(text,uuid) from public,anon,authenticated,service_role;
create function pcm.sso_listar_pertinencia_evidencia(p_tipo text,p_anexo_id uuid,p_apos integer,p_limite integer)
returns table(revisao integer,edicao_revision integer,decisao text,motivo text,ator_id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
declare v_estado jsonb;
begin
  if p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<0) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  v_estado:=pcm.sso_consultar_pertinencia_evidencia(p_tipo,p_anexo_id);
  return query select e.revisao,e.edicao_revision,e.decisao,e.motivo,e.ator_id,e.criado_em from pcm.sso_pertinencia_evidencia e where e.tipo=p_tipo and e.anexo_id=p_anexo_id and (p_apos is null or e.revisao>p_apos) order by e.revisao limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_pertinencia_evidencia(text,uuid,integer,integer) from public,anon,authenticated,service_role;
