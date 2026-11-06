-- ADR-0420: retirada auditada da projeção ativa, sem alterar Chamado.
create table pcm.sso_retirar_pendencia_composicao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_retirar_pendencia_composicao_gate(id,habilitado) values(true,false);
create table pcm.sso_retiradas_pendencia_composicao(id uuid primary key default gen_random_uuid(),composicao_id uuid not null references pcm.sso_backlog_composicoes(id),pendencia_id uuid not null references pcm.sso_pendencias_tecnicas(id),cliente_id uuid not null references pcm.clientes(id),revisao_origem integer not null,revisao_composicao integer not null,motivo text not null check(length(btrim(motivo)) between 1 and 2000),ator_id uuid not null references auth.users(id),request_id uuid not null unique,payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now());
alter table pcm.sso_retirar_pendencia_composicao_gate enable row level security;alter table pcm.sso_retirar_pendencia_composicao_gate force row level security;
alter table pcm.sso_retiradas_pendencia_composicao enable row level security;alter table pcm.sso_retiradas_pendencia_composicao force row level security;
revoke all on pcm.sso_retirar_pendencia_composicao_gate,pcm.sso_retiradas_pendencia_composicao from public,anon,authenticated,service_role;
create function pcm.sso_retiradas_pendencia_composicao_imutaveis() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'historico_imutavel' using errcode='23514'; end; $$;
revoke all on function pcm.sso_retiradas_pendencia_composicao_imutaveis() from public,anon,authenticated,service_role;
create trigger sso_retiradas_pendencia_composicao_imutaveis before update or delete on pcm.sso_retiradas_pendencia_composicao for each row execute function pcm.sso_retiradas_pendencia_composicao_imutaveis();
create function pcm.sso_retirar_pendencia_composicao(p_request_id uuid,p_composicao_id uuid,p_pendencia_id uuid,p_revision integer,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_c pcm.sso_backlog_composicoes%rowtype;v_p pcm.sso_pendencias_tecnicas%rowtype;v_b pcm.sso_backlog_pendencias%rowtype;v_ant pcm.sso_retiradas_pendencia_composicao%rowtype;v_payload jsonb;v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_retirar_pendencia_composicao_gate where id),false) then raise exception 'retirada_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_composicao_id is null or p_pendencia_id is null or p_revision is null or p_revision<1 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('composicaoId',p_composicao_id,'pendenciaId',p_pendencia_id,'revision',p_revision,'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('retirada-composicao:'||p_request_id::text,0));
  select * into v_c from pcm.sso_backlog_composicoes where id=p_composicao_id for update;
  if not found or config.sso_autorizar_acao('execucao.validar',v_c.cliente_id) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',v_c.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_ant from pcm.sso_retiradas_pendencia_composicao where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from v_ator or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return v_ant.resultado;
  end if;
  if v_c.revisao<>p_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  select * into v_p from pcm.sso_pendencias_tecnicas where id=p_pendencia_id and cliente_id=v_c.cliente_id for update;
  if not found then raise exception 'pendencia_indisponivel' using errcode='23514'; end if;
  select * into v_b from pcm.sso_backlog_pendencias where composicao_id=p_composicao_id and pendencia_id=p_pendencia_id for update;
  if not found or exists(select 1 from pcm.sso_backlog_parcelas where pendencia_id=p_pendencia_id) then raise exception 'pendencia_vinculada_ou_indisponivel' using errcode='23514'; end if;
  delete from pcm.sso_backlog_pendencias where composicao_id=p_composicao_id and pendencia_id=p_pendencia_id;
  update pcm.sso_backlog_composicoes set revisao=revisao+1 where id=p_composicao_id returning * into v_c;
  v_resultado:=jsonb_build_object('composicaoId',p_composicao_id,'pendenciaId',p_pendencia_id,'revision',v_c.revisao,'requestId',p_request_id);
  insert into pcm.sso_retiradas_pendencia_composicao(composicao_id,pendencia_id,cliente_id,revisao_origem,revisao_composicao,motivo,ator_id,request_id,payload,resultado) values(p_composicao_id,p_pendencia_id,v_c.cliente_id,v_b.revisao_origem,v_c.revisao,btrim(p_motivo),v_ator,p_request_id,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'backlog.pendencia_retirada','sso_backlog_composicoes',p_composicao_id,v_resultado||jsonb_build_object('clienteId',v_c.cliente_id,'revisaoOrigem',v_b.revisao_origem,'motivo',btrim(p_motivo)));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_retirar_pendencia_composicao(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
create function pcm.sso_consultar_retirada_composicao(p_composicao_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_c pcm.sso_backlog_composicoes%rowtype;v_total bigint;
begin
  if not coalesce((select habilitado from pcm.sso_retirar_pendencia_composicao_gate where id),false) then raise exception 'retirada_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_composicao_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select * into v_c from pcm.sso_backlog_composicoes where id=p_composicao_id;
  if not found or config.sso_autorizar_acao('execucao.validar',v_c.cliente_id) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',v_c.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select count(*) into v_total from pcm.sso_backlog_pendencias where composicao_id=p_composicao_id;
  return jsonb_build_object('composicaoId',p_composicao_id,'revision',v_c.revisao,'total',v_total);
end;
$$;
revoke all on function pcm.sso_consultar_retirada_composicao(uuid) from public,anon,authenticated,service_role;
create function pcm.sso_historico_retirada_composicao(p_composicao_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,pendencia_id uuid,revisao_origem integer,revisao_composicao integer,motivo text,ator_id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
declare v_estado jsonb;
begin
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  v_estado:=pcm.sso_consultar_retirada_composicao(p_composicao_id);
  return query select r.id,r.pendencia_id,r.revisao_origem,r.revisao_composicao,r.motivo,r.ator_id,r.criado_em from pcm.sso_retiradas_pendencia_composicao r where r.composicao_id=p_composicao_id and (p_apos is null or r.id>p_apos) order by r.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_historico_retirada_composicao(uuid,uuid,integer) from public,anon,authenticated,service_role;
