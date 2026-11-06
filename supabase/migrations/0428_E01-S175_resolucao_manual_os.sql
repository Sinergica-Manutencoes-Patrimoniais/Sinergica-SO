-- ADR-0202: comando preparado e fechado, nenhuma ação Auvo.
create table pcm.sso_origem_campo_resolucao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_origem_campo_resolucao_gate(id,habilitado) values(true,false);
create table pcm.sso_origem_campo_resolucao_permissoes(txid bigint not null,envelope_id uuid not null,primary key(txid,envelope_id));
create table pcm.sso_origem_campo_resolucao_comandos(request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),payload jsonb not null,resultado jsonb not null);
alter table pcm.sso_origem_campo_resolucao_gate enable row level security;
alter table pcm.sso_origem_campo_resolucao_gate force row level security;
alter table pcm.sso_origem_campo_resolucao_permissoes enable row level security;
alter table pcm.sso_origem_campo_resolucao_permissoes force row level security;
alter table pcm.sso_origem_campo_resolucao_comandos enable row level security;
alter table pcm.sso_origem_campo_resolucao_comandos force row level security;
revoke all on pcm.sso_origem_campo_resolucao_gate,pcm.sso_origem_campo_resolucao_permissoes,pcm.sso_origem_campo_resolucao_comandos from public,anon,authenticated,service_role;
create or replace function pcm.sso_triagem_impedir_resolucao_automatica() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform 1 from pcm.origem_campo_inbox where id=new.envelope_id for update;
  if not found then raise exception 'envelope_indisponivel' using errcode='23514'; end if;
  if exists(select 1 from pcm.sso_origem_campo_triagens t where t.envelope_id=new.envelope_id)
    and not exists(select 1 from pcm.sso_origem_campo_resolucao_permissoes p where p.txid=pg_catalog.txid_current() and p.envelope_id=new.envelope_id) then
    raise exception 'triagem_exige_reconciliacao' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function pcm.sso_triagem_impedir_resolucao_automatica() from public,anon,authenticated,service_role;

create function pcm.sso_resolver_os_origem_triagem(p_request_id uuid,p_envelope_id uuid,p_expected_revision integer,p_os_id uuid,p_motivo text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_env pcm.origem_campo_inbox%rowtype;v_t pcm.sso_origem_campo_triagens%rowtype;
  v_cmd pcm.sso_origem_campo_resolucao_comandos%rowtype;v_payload jsonb;v_resultado jsonb;v_id uuid;
begin
  if not coalesce((select habilitado from pcm.sso_origem_campo_resolucao_gate where id),false) then raise exception 'resolucao_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_envelope_id is null or p_expected_revision is null or p_expected_revision<1 or p_os_id is null or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('envelopeId',p_envelope_id,'revision',p_expected_revision,'osId',p_os_id,'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('resolucao-manual:'||p_request_id::text,0));
  select * into v_cmd from pcm.sso_origem_campo_resolucao_comandos where request_id=p_request_id;
  if found then
    if v_cmd.ator_id is distinct from v_ator or config.sso_autorizar_triagem_global() is not true or config.sso_autorizar_acao('integracao.reconciliar',v_cmd.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
    if v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return v_cmd.resultado;
  end if;
  if config.sso_autorizar_triagem_global() is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_env from pcm.origem_campo_inbox where id=p_envelope_id for update;
  if not found or v_env.integracao<>'auvo' or exists(select 1 from pcm.origem_campo_resolucoes where envelope_id=p_envelope_id and resultado='os_identificada') then raise exception 'envelope_indisponivel' using errcode='23514'; end if;
  select * into v_t from pcm.sso_origem_campo_triagens where envelope_id=p_envelope_id for update;
  if not found or config.sso_autorizar_acao('integracao.reconciliar',v_t.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if v_t.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  perform 1 from pcm.ordens_servico where id=p_os_id and client_id=v_t.cliente_id and auvo_task_id=v_env.task_id and deleted_at is null for share;
  if not found then raise exception 'os_incompativel' using errcode='23514'; end if;
  if config.sso_autorizar_triagem_global() is not true or config.sso_autorizar_acao('integracao.reconciliar',v_t.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  insert into pcm.sso_origem_campo_resolucao_permissoes(txid,envelope_id) values(pg_catalog.txid_current(),p_envelope_id);
  insert into pcm.origem_campo_resolucoes(envelope_id,cliente_id,os_id,resultado) values(p_envelope_id,v_t.cliente_id,p_os_id,'os_identificada') returning id into v_id;
  delete from pcm.sso_origem_campo_resolucao_permissoes where txid=pg_catalog.txid_current() and envelope_id=p_envelope_id;
  v_resultado:=jsonb_build_object('envelopeId',p_envelope_id,'clienteId',v_t.cliente_id,'osId',p_os_id,'resolucaoId',v_id,'requestId',p_request_id,'eventoAplicado',false);
  insert into pcm.sso_origem_campo_resolucao_comandos(request_id,ator_id,cliente_id,payload,resultado) values(p_request_id,v_ator,v_t.cliente_id,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'origem_campo.os_resolvida_manualmente','origem_campo_inbox',p_envelope_id,v_resultado||jsonb_build_object('motivo',btrim(p_motivo),'triagemRevision',p_expected_revision));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_resolver_os_origem_triagem(uuid,uuid,integer,uuid,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_os_para_origem_triagem(p_envelope_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid) language plpgsql stable security definer set search_path='' as $$
declare v_env pcm.origem_campo_inbox%rowtype;v_t pcm.sso_origem_campo_triagens%rowtype;
begin
  if p_envelope_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_triagem_global() is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_env from pcm.origem_campo_inbox where id=p_envelope_id;
  select * into v_t from pcm.sso_origem_campo_triagens where envelope_id=p_envelope_id;
  if v_env.id is null or v_t.envelope_id is null or v_env.integracao<>'auvo' or config.sso_autorizar_acao('integracao.reconciliar',v_t.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select o.id from pcm.ordens_servico o where o.client_id=v_t.cliente_id and o.auvo_task_id=v_env.task_id and o.deleted_at is null and (p_apos is null or o.id>p_apos) order by o.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_os_para_origem_triagem(uuid,uuid,integer) from public,anon,authenticated,service_role;
