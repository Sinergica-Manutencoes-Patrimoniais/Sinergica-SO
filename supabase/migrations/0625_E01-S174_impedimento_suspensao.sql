-- ADR-0399: wrapper aditivo e fechado, sem inferir evidência.
create table pcm.sso_impedimento_suspensao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_impedimento_suspensao_gate(id,habilitado) values(true,false);
create table pcm.sso_impedimentos_suspensao(chamado_id uuid not null,revisao integer not null,impedimento text not null check(length(btrim(impedimento)) between 1 and 2000),ator_id uuid not null references auth.users(id),request_id uuid not null unique,payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now(),primary key(chamado_id,revisao),foreign key(chamado_id,revisao) references pcm.sso_suspensoes_chamado_eventos(chamado_id,revisao));
alter table pcm.sso_impedimento_suspensao_gate enable row level security;alter table pcm.sso_impedimento_suspensao_gate force row level security;
alter table pcm.sso_impedimentos_suspensao enable row level security;alter table pcm.sso_impedimentos_suspensao force row level security;
revoke all on pcm.sso_impedimento_suspensao_gate,pcm.sso_impedimentos_suspensao from public,anon,authenticated,service_role;
create function pcm.sso_impedimento_suspensao_imutavel() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'historico_imutavel' using errcode='23514'; end; $$;
revoke all on function pcm.sso_impedimento_suspensao_imutavel() from public,anon,authenticated,service_role;
create trigger sso_impedimento_suspensao_imutavel before update or delete on pcm.sso_impedimentos_suspensao for each row execute function pcm.sso_impedimento_suspensao_imutavel();
create table pcm.sso_exigir_impedimento_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_exigir_impedimento_gate(id,habilitado) values(true,false);
create table pcm.sso_autorizacoes_impedimento(txid bigint not null,request_id uuid not null,ator_id uuid not null,primary key(txid,request_id,ator_id));
alter table pcm.sso_exigir_impedimento_gate enable row level security;alter table pcm.sso_exigir_impedimento_gate force row level security;
alter table pcm.sso_autorizacoes_impedimento enable row level security;alter table pcm.sso_autorizacoes_impedimento force row level security;
revoke all on pcm.sso_exigir_impedimento_gate,pcm.sso_autorizacoes_impedimento from public,anon,authenticated,service_role;
create function pcm.sso_guardar_impedimento_suspensao() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.estado='suspenso' and coalesce((select habilitado from pcm.sso_exigir_impedimento_gate where id),false) then
    delete from pcm.sso_autorizacoes_impedimento where txid=pg_catalog.txid_current() and request_id=new.request_id and ator_id=auth.uid();
    if not found then raise exception 'impedimento_obrigatorio' using errcode='23514'; end if;
  end if;return new;
end;
$$;
revoke all on function pcm.sso_guardar_impedimento_suspensao() from public,anon,authenticated,service_role;
create trigger sso_guardar_impedimento_suspensao before insert on pcm.sso_suspensoes_chamado_eventos for each row execute function pcm.sso_guardar_impedimento_suspensao();
create function pcm.sso_suspender_com_impedimento(p_request_id uuid,p_chamado_id uuid,p_chamado_revision bigint,p_expected_revision integer,p_motivo text,p_impedimento text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_c pcm.chamados%rowtype;v_ant pcm.sso_impedimentos_suspensao%rowtype;v_payload jsonb;v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_impedimento_suspensao_gate where id),false) then raise exception 'suspensao_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_chamado_id is null or p_chamado_revision is null or p_chamado_revision<1 or p_expected_revision is null or p_expected_revision<0 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 or p_impedimento is null or length(btrim(p_impedimento)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('chamadoId',p_chamado_id,'chamadoRevision',p_chamado_revision,'expectedRevision',p_expected_revision,'motivo',btrim(p_motivo),'impedimento',btrim(p_impedimento));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('suspensao-chamado:'||p_request_id::text,0));
  select * into v_c from pcm.chamados where id=p_chamado_id for update;
  if not found or v_c.deleted_at is not null or config.sso_autorizar_acao('chamado.escopo.gerir',v_c.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_ant from pcm.sso_impedimentos_suspensao where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from v_ator or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return v_ant.resultado;
  end if;
  if exists(select 1 from pcm.sso_suspensoes_chamado_eventos where request_id=p_request_id) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  if coalesce((select habilitado from pcm.sso_exigir_impedimento_gate where id),false) then insert into pcm.sso_autorizacoes_impedimento(txid,request_id,ator_id) values(pg_catalog.txid_current(),p_request_id,v_ator); end if;
  v_resultado:=pcm.sso_alterar_suspensao_chamado(p_request_id,p_chamado_id,p_chamado_revision,p_expected_revision,'suspenso',p_motivo);
  delete from pcm.sso_autorizacoes_impedimento where txid=pg_catalog.txid_current() and request_id=p_request_id and ator_id=v_ator;
  insert into pcm.sso_impedimentos_suspensao(chamado_id,revisao,impedimento,ator_id,request_id,payload,resultado) values(p_chamado_id,p_expected_revision+1,btrim(p_impedimento),v_ator,p_request_id,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'chamado.impedimento_suspensao','chamados',p_chamado_id,jsonb_build_object('clienteId',v_c.cliente_id,'revision',p_expected_revision+1,'impedimento',btrim(p_impedimento),'requestId',p_request_id));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_suspender_com_impedimento(uuid,uuid,bigint,integer,text,text) from public,anon,authenticated,service_role;
