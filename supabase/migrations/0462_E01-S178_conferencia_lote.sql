-- ADR-0236: fundação de conferência, sem incorporação automática.
create table pcm.sso_conferencia_lote_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_conferencia_lote_gate(id,habilitado) values(true,false);
create table pcm.sso_conferencia_linhas(lote_id uuid not null,linha_chave text not null,revisao integer not null,ator_id uuid not null references auth.users(id),request_id uuid not null unique,atributos jsonb not null,criado_em timestamptz not null default now(),primary key(lote_id,linha_chave),foreign key(lote_id,linha_chave) references pcm.sso_levantamento_linhas(lote_id,chave));
create table pcm.sso_conferencia_lotes(lote_id uuid not null references pcm.sso_levantamentos(id),revisao integer not null,ator_id uuid not null references auth.users(id),request_id uuid not null unique,total integer not null,criado_em timestamptz not null default now(),primary key(lote_id,revisao));
alter table pcm.sso_conferencia_lote_gate enable row level security;alter table pcm.sso_conferencia_lote_gate force row level security;
alter table pcm.sso_conferencia_linhas enable row level security;alter table pcm.sso_conferencia_linhas force row level security;
alter table pcm.sso_conferencia_lotes enable row level security;alter table pcm.sso_conferencia_lotes force row level security;
revoke all on pcm.sso_conferencia_lote_gate,pcm.sso_conferencia_linhas,pcm.sso_conferencia_lotes from public,anon,authenticated,service_role;
create function pcm.sso_registrar_conferencia_linha(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_atributos jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_lote pcm.sso_levantamentos%rowtype;v_linha pcm.sso_levantamento_linhas%rowtype;v_existente pcm.sso_conferencia_linhas%rowtype;v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_conferencia_lote_gate where id),false) then raise exception 'conferencia_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1 or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or jsonb_typeof(p_atributos) is distinct from 'object' then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('conferencia-lote:'||p_request_id::text,0));
  select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_existente from pcm.sso_conferencia_linhas where request_id=p_request_id;
  if found then
    if v_existente.ator_id is distinct from v_ator or v_existente.lote_id is distinct from p_lote_id or v_existente.linha_chave is distinct from p_chave or v_existente.revisao<>p_expected_revision+1 or v_existente.atributos is distinct from p_atributos then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('loteId',p_lote_id,'chave',p_chave,'revision',v_existente.revisao,'requestId',p_request_id);
  end if;
  if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  select * into v_linha from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave;
  if not found or v_linha.atributos is distinct from p_atributos or exists(select 1 from pcm.sso_conferencia_linhas where lote_id=p_lote_id and linha_chave=p_chave)
    or exists(select 1 from pcm.sso_levantamento_rejeicoes where lote_id=p_lote_id and linha_chave=p_chave) or exists(select 1 from pcm.sso_levantamento_incorporacoes where lote_id=p_lote_id and linha_chave=p_chave) then raise exception 'linha_indisponivel' using errcode='23514'; end if;
  update pcm.sso_levantamentos set revisao=revisao+1 where id=p_lote_id returning * into v_lote;
  insert into pcm.sso_conferencia_linhas(lote_id,linha_chave,revisao,ator_id,request_id,atributos) values(p_lote_id,p_chave,v_lote.revisao,v_ator,p_request_id,p_atributos);
  v_resultado:=jsonb_build_object('loteId',p_lote_id,'chave',p_chave,'revision',v_lote.revisao,'requestId',p_request_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.linha_conferida','sso_levantamentos',p_lote_id,v_resultado||jsonb_build_object('clienteId',v_lote.cliente_id));return v_resultado;
end;
$$;
revoke all on function pcm.sso_registrar_conferencia_linha(uuid,uuid,integer,text,jsonb) from public,anon,authenticated,service_role;

create function pcm.sso_resumo_conferencia_lote(p_lote_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_total integer;v_pendentes integer;
begin
  select * into v_lote from pcm.sso_levantamentos where id=p_lote_id;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select count(*),count(*) filter(where not exists(select 1 from pcm.sso_conferencia_linhas c where c.lote_id=l.lote_id and c.linha_chave=l.chave and c.atributos=l.atributos)
    and not exists(select 1 from pcm.sso_levantamento_rejeicoes r where r.lote_id=l.lote_id and r.linha_chave=l.chave)
    and not exists(select 1 from pcm.sso_levantamento_incorporacoes i where i.lote_id=l.lote_id and i.linha_chave=l.chave)) into v_total,v_pendentes from pcm.sso_levantamento_linhas l where l.lote_id=p_lote_id;
  return jsonb_build_object('loteId',p_lote_id,'revision',v_lote.revisao,'total',v_total,'pendentes',v_pendentes,'conferenciaRegistrada',exists(select 1 from pcm.sso_conferencia_lotes c where c.lote_id=p_lote_id and c.revisao=v_lote.revisao));
end;
$$;
revoke all on function pcm.sso_resumo_conferencia_lote(uuid) from public,anon,authenticated,service_role;

create function pcm.sso_concluir_conferencia_lote(p_request_id uuid,p_lote_id uuid,p_expected_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_lote pcm.sso_levantamentos%rowtype;v_e pcm.sso_conferencia_lotes%rowtype;v_resumo jsonb;v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_conferencia_lote_gate where id),false) then raise exception 'conferencia_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('conferencia-lote:'||p_request_id::text,0));
  select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_e from pcm.sso_conferencia_lotes where request_id=p_request_id;
  if found then
    if v_e.ator_id is distinct from v_ator or v_e.lote_id is distinct from p_lote_id or v_e.revisao<>p_expected_revision+1 then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('loteId',p_lote_id,'revision',v_e.revisao,'total',v_e.total,'requestId',p_request_id);
  end if;
  if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  v_resumo:=pcm.sso_resumo_conferencia_lote(p_lote_id);
  if (v_resumo->>'total')::integer=0 or (v_resumo->>'pendentes')::integer<>0 then raise exception 'linhas_pendentes' using errcode='23514'; end if;
  update pcm.sso_levantamentos set revisao=revisao+1 where id=p_lote_id returning * into v_lote;
  insert into pcm.sso_conferencia_lotes(lote_id,revisao,ator_id,request_id,total) values(p_lote_id,v_lote.revisao,v_ator,p_request_id,(v_resumo->>'total')::integer);
  v_resultado:=jsonb_build_object('loteId',p_lote_id,'revision',v_lote.revisao,'total',(v_resumo->>'total')::integer,'requestId',p_request_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.conferencia_consolidada','sso_levantamentos',p_lote_id,v_resultado||jsonb_build_object('clienteId',v_lote.cliente_id));return v_resultado;
end;
$$;
revoke all on function pcm.sso_concluir_conferencia_lote(uuid,uuid,integer) from public,anon,authenticated,service_role;
