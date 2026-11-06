-- ADR-0243: transição aditiva, sem apagar histórico ou cadastros.
create table pcm.sso_conferencia_ciclos(lote_id uuid primary key references pcm.sso_levantamentos(id),ciclo integer not null check(ciclo>0),ultima_reabertura_revision integer not null default 0);
alter table pcm.sso_conferencia_linhas add column ciclo integer not null default 1 check(ciclo>0);
alter table pcm.sso_conferencia_linhas drop constraint sso_conferencia_linhas_pkey;
alter table pcm.sso_conferencia_linhas add primary key(lote_id,linha_chave,ciclo);
create table pcm.sso_conferencia_reaberturas(lote_id uuid not null references pcm.sso_levantamentos(id),ciclo integer not null,revisao integer not null,motivo text not null check(length(btrim(motivo)) between 1 and 2000),ator_id uuid not null references auth.users(id),request_id uuid not null unique,criado_em timestamptz not null default now(),primary key(lote_id,ciclo));
alter table pcm.sso_conferencia_ciclos enable row level security;alter table pcm.sso_conferencia_ciclos force row level security;
alter table pcm.sso_conferencia_reaberturas enable row level security;alter table pcm.sso_conferencia_reaberturas force row level security;
revoke all on pcm.sso_conferencia_ciclos,pcm.sso_conferencia_reaberturas from public,anon,authenticated,service_role;
create function pcm.sso_conferencia_reaberturas_imutaveis() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'historico_imutavel' using errcode='23514';end; $$;
revoke all on function pcm.sso_conferencia_reaberturas_imutaveis() from public,anon,authenticated,service_role;
create trigger sso_conferencia_reaberturas_imutaveis before update or delete on pcm.sso_conferencia_reaberturas for each row execute function pcm.sso_conferencia_reaberturas_imutaveis();

create function pcm.sso_reabrir_conferencia_lote(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_motivo text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_lote pcm.sso_levantamentos%rowtype;v_ant pcm.sso_conferencia_reaberturas%rowtype;v_ciclo integer;v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_conferencia_lote_gate where id),false) then raise exception 'conferencia_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('conferencia-lote:'||p_request_id::text,0));
  select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_ant from pcm.sso_conferencia_reaberturas where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from v_ator or v_ant.lote_id is distinct from p_lote_id or v_ant.revisao<>p_expected_revision+1 or v_ant.motivo is distinct from btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('loteId',p_lote_id,'revision',v_ant.revisao,'ciclo',v_ant.ciclo,'requestId',p_request_id);
  end if;
  if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if exists(select 1 from pcm.sso_levantamento_incorporacoes where lote_id=p_lote_id) then raise exception 'lote_ja_incorporado' using errcode='23514'; end if;
  if not exists(select 1 from pcm.sso_conferencia_lotes c where c.lote_id=p_lote_id and c.revisao>coalesce((select ultima_reabertura_revision from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),0))
    and not exists(select 1 from pcm.sso_conferencia_linhas c where c.lote_id=p_lote_id and c.ciclo=coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),1)) then raise exception 'conferencia_nao_iniciada' using errcode='23514'; end if;
  select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),1)+1 into v_ciclo;
  update pcm.sso_levantamentos set revisao=revisao+1 where id=p_lote_id returning * into v_lote;
  insert into pcm.sso_conferencia_ciclos(lote_id,ciclo,ultima_reabertura_revision) values(p_lote_id,v_ciclo,v_lote.revisao)
    on conflict(lote_id) do update set ciclo=excluded.ciclo,ultima_reabertura_revision=excluded.ultima_reabertura_revision;
  insert into pcm.sso_conferencia_reaberturas(lote_id,ciclo,revisao,motivo,ator_id,request_id) values(p_lote_id,v_ciclo,v_lote.revisao,btrim(p_motivo),v_ator,p_request_id);
  v_resultado:=jsonb_build_object('loteId',p_lote_id,'revision',v_lote.revisao,'ciclo',v_ciclo,'requestId',p_request_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.conferencia_reaberta','sso_levantamentos',p_lote_id,v_resultado||jsonb_build_object('clienteId',v_lote.cliente_id,'motivo',btrim(p_motivo)));return v_resultado;
end;
$$;
revoke all on function pcm.sso_reabrir_conferencia_lote(uuid,uuid,integer,text) from public,anon,authenticated,service_role;

create or replace function pcm.sso_registrar_conferencia_linha(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_atributos jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_lote pcm.sso_levantamentos%rowtype;v_linha pcm.sso_levantamento_linhas%rowtype;v_existente pcm.sso_conferencia_linhas%rowtype;v_ciclo integer;v_resultado jsonb;
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
  select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),1) into v_ciclo;
  select * into v_linha from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave;
  if not found or v_linha.atributos is distinct from p_atributos or exists(select 1 from pcm.sso_conferencia_linhas where lote_id=p_lote_id and linha_chave=p_chave and ciclo=v_ciclo)
    or exists(select 1 from pcm.sso_levantamento_rejeicoes where lote_id=p_lote_id and linha_chave=p_chave) or exists(select 1 from pcm.sso_levantamento_incorporacoes where lote_id=p_lote_id and linha_chave=p_chave) then raise exception 'linha_indisponivel' using errcode='23514'; end if;
  update pcm.sso_levantamentos set revisao=revisao+1 where id=p_lote_id returning * into v_lote;
  insert into pcm.sso_conferencia_linhas(lote_id,linha_chave,revisao,ator_id,request_id,atributos,ciclo) values(p_lote_id,p_chave,v_lote.revisao,v_ator,p_request_id,p_atributos,v_ciclo);
  v_resultado:=jsonb_build_object('loteId',p_lote_id,'chave',p_chave,'revision',v_lote.revisao,'requestId',p_request_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.linha_conferida','sso_levantamentos',p_lote_id,v_resultado||jsonb_build_object('clienteId',v_lote.cliente_id,'ciclo',v_ciclo));return v_resultado;
end;
$$;
revoke all on function pcm.sso_registrar_conferencia_linha(uuid,uuid,integer,text,jsonb) from public,anon,authenticated,service_role;

create or replace function pcm.sso_resumo_conferencia_lote(p_lote_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_total integer;v_pendentes integer;v_ciclo integer;v_reabertura integer;
begin
  select * into v_lote from pcm.sso_levantamentos where id=p_lote_id;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),1),coalesce((select ultima_reabertura_revision from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),0) into v_ciclo,v_reabertura;
  select count(*),count(*) filter(where not exists(select 1 from pcm.sso_conferencia_linhas c where c.lote_id=l.lote_id and c.linha_chave=l.chave and c.ciclo=v_ciclo and c.atributos=l.atributos)
    and not exists(select 1 from pcm.sso_levantamento_rejeicoes r where r.lote_id=l.lote_id and r.linha_chave=l.chave)
    and not exists(select 1 from pcm.sso_levantamento_incorporacoes i where i.lote_id=l.lote_id and i.linha_chave=l.chave)) into v_total,v_pendentes from pcm.sso_levantamento_linhas l where l.lote_id=p_lote_id;
  return jsonb_build_object('loteId',p_lote_id,'revision',v_lote.revisao,'total',v_total,'pendentes',v_pendentes,'conferenciaRegistrada',exists(select 1 from pcm.sso_conferencia_lotes c where c.lote_id=p_lote_id and c.revisao>v_reabertura));
end;
$$;
revoke all on function pcm.sso_resumo_conferencia_lote(uuid) from public,anon,authenticated,service_role;

create or replace function pcm.sso_impedir_codigo_apos_conferencia() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from pcm.sso_conferencia_linhas c where c.lote_id=new.lote_id and c.linha_chave=new.linha_chave and c.ciclo=coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=new.lote_id),1)) then raise exception 'linha_ja_conferida' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function pcm.sso_impedir_codigo_apos_conferencia() from public,anon,authenticated,service_role;
create or replace function pcm.sso_exigir_lote_conferido() returns trigger language plpgsql security definer set search_path='' as $$
declare v_aprovacao integer;v_atributos jsonb;v_codigo integer;v_congelado integer;v_ciclo integer;v_reabertura integer;
begin
  if not coalesce((select habilitado from pcm.sso_incorporacao_aprovacao_gate where id),false) then raise exception 'incorporacao_bloqueada_por_aprovacao' using errcode='55000'; end if;
  perform 1 from pcm.sso_levantamentos where id=new.lote_id for update;
  if not found then raise exception 'lote_indisponivel' using errcode='23514'; end if;
  select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=new.lote_id),1),coalesce((select ultima_reabertura_revision from pcm.sso_conferencia_ciclos where lote_id=new.lote_id),0) into v_ciclo,v_reabertura;
  select max(revisao) into v_aprovacao from pcm.sso_conferencia_lotes where lote_id=new.lote_id and revisao>v_reabertura;
  select atributos into v_atributos from pcm.sso_levantamento_linhas where lote_id=new.lote_id and chave=new.linha_chave;
  if v_aprovacao is null or v_atributos is null or not exists(select 1 from pcm.sso_conferencia_linhas c where c.lote_id=new.lote_id and c.linha_chave=new.linha_chave and c.ciclo=v_ciclo and c.revisao<v_aprovacao and c.atributos=v_atributos) then raise exception 'linha_ou_lote_nao_conferido' using errcode='23514'; end if;
  select codigo_revision into v_congelado from pcm.sso_conferencia_lote_codigos where lote_id=new.lote_id and conferencia_revision=v_aprovacao and linha_chave=new.linha_chave;
  select revisao into v_codigo from pcm.sso_codigo_staging where lote_id=new.lote_id and linha_chave=new.linha_chave;
  if v_congelado is null or v_congelado<>coalesce(v_codigo,0) then raise exception 'codigo_apos_conferencia' using errcode='40001'; end if;
  return new;
end;
$$;
revoke all on function pcm.sso_exigir_lote_conferido() from public,anon,authenticated,service_role;
