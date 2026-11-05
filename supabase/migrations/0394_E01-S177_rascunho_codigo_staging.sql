-- ADR-0168: sem efeito cadastral nem Auvo; gate e execução fechados.
create table pcm.sso_codigo_staging_gate (id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_codigo_staging_gate(id,habilitado) values(true,false);
alter table pcm.sso_codigo_staging_gate enable row level security;
alter table pcm.sso_codigo_staging_gate force row level security;
revoke all on pcm.sso_codigo_staging_gate from public,anon,authenticated,service_role;
create table pcm.sso_codigo_staging (
  lote_id uuid not null, linha_chave text not null, codigo text not null check(length(codigo) between 1 and 200),
  revisao integer not null default 1 check(revisao>0), atualizado_em timestamptz not null default now(), atualizado_por uuid not null references auth.users(id),
  primary key(lote_id,linha_chave), foreign key(lote_id,linha_chave) references pcm.sso_levantamento_linhas(lote_id,chave)
);
create table pcm.sso_codigo_staging_comandos (
  request_id uuid primary key, ator_id uuid not null references auth.users(id), cliente_id uuid not null references pcm.clientes(id),
  payload jsonb not null, resultado jsonb not null, criado_em timestamptz not null default now()
);
alter table pcm.sso_codigo_staging enable row level security;
alter table pcm.sso_codigo_staging force row level security;
alter table pcm.sso_codigo_staging_comandos enable row level security;
alter table pcm.sso_codigo_staging_comandos force row level security;
revoke all on pcm.sso_codigo_staging,pcm.sso_codigo_staging_comandos from public,anon,authenticated,service_role;

create function pcm.sso_salvar_codigo_staging(p_request_id uuid,p_lote_id uuid,p_chave text,p_lote_revisao integer,p_revisao integer,p_codigo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_ator uuid:=auth.uid(); v_lote pcm.sso_levantamentos%rowtype; v_linha pcm.sso_levantamento_linhas%rowtype;
  v_anterior pcm.sso_codigo_staging%rowtype; v_cmd pcm.sso_codigo_staging_comandos%rowtype; v_payload jsonb; v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_codigo_staging_gate where id),false) then raise exception 'rascunho_desabilitado' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_lote_id is null or p_chave is null or length(btrim(p_chave)) not between 1 and 200
    or p_lote_revisao is null or p_lote_revisao<1 or p_revisao is null or p_revisao<0 or p_codigo is null
    or length(p_codigo) not between 1 and 200 or p_codigo<>upper(btrim(p_codigo)) or p_codigo~'[[:space:]]' then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('loteId',p_lote_id,'chave',p_chave,'loteRevision',p_lote_revisao,'revision',p_revisao,'codigo',p_codigo);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('staging-codigo:' || p_request_id::text,0));
  select * into v_cmd from pcm.sso_codigo_staging_comandos where request_id=p_request_id;
  if found then
    if v_cmd.ator_id is distinct from v_ator or config.sso_autorizar_acao('cadastro.gerir',v_cmd.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
    if v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_cmd.resultado;
  end if;
  select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
  if not found or config.sso_autorizar_acao('cadastro.gerir',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if v_lote.revisao<>p_lote_revisao then raise exception 'revisao_lote_obsoleta' using errcode='40001'; end if;
  select * into v_linha from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave;
  if not found or v_linha.tipo not in ('sistema','equipamento','componente') or exists(select 1 from pcm.sso_levantamento_incorporacoes i where i.lote_id=p_lote_id and i.linha_chave=p_chave)
    or exists(select 1 from pcm.sso_levantamento_rejeicoes r where r.lote_id=p_lote_id and r.linha_chave=p_chave) then raise exception 'linha_indisponivel' using errcode='23514'; end if;
  select * into v_anterior from pcm.sso_codigo_staging where lote_id=p_lote_id and linha_chave=p_chave for update;
  if coalesce(v_anterior.revisao,0)<>p_revisao then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  insert into pcm.sso_codigo_staging(lote_id,linha_chave,codigo,revisao,atualizado_por) values(p_lote_id,p_chave,p_codigo,p_revisao+1,v_ator)
    on conflict(lote_id,linha_chave) do update set codigo=excluded.codigo,revisao=excluded.revisao,atualizado_por=excluded.atualizado_por,atualizado_em=now();
  v_resultado:=jsonb_build_object('loteId',p_lote_id,'chave',p_chave,'revision',p_revisao+1,'codigo',p_codigo,'requestId',p_request_id);
  insert into pcm.sso_codigo_staging_comandos(request_id,ator_id,cliente_id,payload,resultado) values(p_request_id,v_ator,v_lote.cliente_id,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.codigo_provisorio','sso_levantamentos',p_lote_id,
    v_resultado || jsonb_build_object('codigoAnterior',v_anterior.codigo,'clienteId',v_lote.cliente_id));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_salvar_codigo_staging(uuid,uuid,text,integer,integer,text) from public,anon,authenticated,service_role;

create function pcm.sso_consultar_codigo_staging(p_lote_id uuid,p_chave text) returns table(codigo text,revisao integer)
language plpgsql stable security definer set search_path = '' as $$
declare v_cliente uuid;
begin
  if p_lote_id is null or p_chave is null or length(btrim(p_chave)) not between 1 and 200 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select cliente_id into v_cliente from pcm.sso_levantamentos where id=p_lote_id;
  if not found or config.sso_autorizar_acao('cadastro.gerir',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select s.codigo,s.revisao from pcm.sso_codigo_staging s where s.lote_id=p_lote_id and s.linha_chave=p_chave;
end;
$$;
revoke all on function pcm.sso_consultar_codigo_staging(uuid,text) from public,anon,authenticated,service_role;
