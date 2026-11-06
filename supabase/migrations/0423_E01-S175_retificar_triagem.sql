-- ADR-0197: gate desligado e funções revogadas.
alter table pcm.sso_origem_campo_triagens add column revisao integer not null default 1 check(revisao>0);
create table pcm.sso_origem_campo_triagem_revisao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_origem_campo_triagem_revisao_gate(id,habilitado) values(true,false);
alter table pcm.sso_origem_campo_triagem_revisao_gate enable row level security;
alter table pcm.sso_origem_campo_triagem_revisao_gate force row level security;
revoke all on pcm.sso_origem_campo_triagem_revisao_gate from public,anon,authenticated,service_role;
create table pcm.sso_origem_campo_triagem_historico(id uuid primary key default gen_random_uuid(),envelope_id uuid not null references pcm.origem_campo_inbox(id),revisao integer not null,
  cliente_anterior uuid references pcm.clientes(id),cliente_novo uuid not null references pcm.clientes(id),motivo text not null,ator_id uuid not null references auth.users(id),request_id uuid not null unique,criado_em timestamptz not null default now(),unique(envelope_id,revisao));
alter table pcm.sso_origem_campo_triagem_historico enable row level security;
alter table pcm.sso_origem_campo_triagem_historico force row level security;
revoke all on pcm.sso_origem_campo_triagem_historico from public,anon,authenticated,service_role;
create function pcm.sso_triagem_registrar_criacao() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into pcm.sso_origem_campo_triagem_historico(envelope_id,revisao,cliente_novo,motivo,ator_id,request_id) values(new.envelope_id,new.revisao,new.cliente_id,new.motivo,new.ator_id,new.request_id);return new;
end;
$$;
revoke all on function pcm.sso_triagem_registrar_criacao() from public,anon,authenticated,service_role;
create trigger sso_triagem_criacao_historico after insert on pcm.sso_origem_campo_triagens for each row execute function pcm.sso_triagem_registrar_criacao();
-- Preserva indicações registradas antes desta migração, se houver, sem alterar dados existentes.
insert into pcm.sso_origem_campo_triagem_historico(envelope_id,revisao,cliente_novo,motivo,ator_id,request_id,criado_em)
select envelope_id,revisao,cliente_id,motivo,ator_id,request_id,criado_em from pcm.sso_origem_campo_triagens;
create function pcm.sso_triagem_historico_imutavel() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'historico_imutavel' using errcode='23514';end; $$;
revoke all on function pcm.sso_triagem_historico_imutavel() from public,anon,authenticated,service_role;
create trigger sso_triagem_historico_imutavel before update or delete on pcm.sso_origem_campo_triagem_historico for each row execute function pcm.sso_triagem_historico_imutavel();
create function pcm.sso_triagem_impedir_resolucao_automatica() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if coalesce((select habilitado from pcm.sso_origem_campo_triagem_revisao_gate where id),false) and exists(select 1 from pcm.sso_origem_campo_triagens t where t.envelope_id=new.envelope_id) then raise exception 'triagem_exige_reconciliacao' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function pcm.sso_triagem_impedir_resolucao_automatica() from public,anon,authenticated,service_role;
create trigger sso_triagem_guardar_resolucao before insert on pcm.origem_campo_resolucoes for each row execute function pcm.sso_triagem_impedir_resolucao_automatica();

create function pcm.sso_retificar_cliente_origem_campo(p_request_id uuid,p_envelope_id uuid,p_expected_revision integer,p_cliente_id uuid,p_motivo text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_t pcm.sso_origem_campo_triagens%rowtype;v_h pcm.sso_origem_campo_triagem_historico%rowtype;v_anterior uuid;v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_origem_campo_triagem_revisao_gate where id),false) then raise exception 'retificacao_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_envelope_id is null or p_expected_revision is null or p_expected_revision<1 or p_cliente_id is null or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('triagem-origem:'||p_request_id::text,0));
  select * into v_h from pcm.sso_origem_campo_triagem_historico where request_id=p_request_id;
  if found then
    if v_h.ator_id is distinct from v_ator or config.sso_autorizar_triagem_global() is not true or config.sso_autorizar_acao('integracao.reconciliar',v_h.cliente_novo) is not true or (v_h.cliente_anterior is not null and config.sso_autorizar_acao('integracao.reconciliar',v_h.cliente_anterior) is not true) then raise exception 'sem_acesso' using errcode='42501'; end if;
    if v_h.envelope_id is distinct from p_envelope_id or v_h.revisao<>p_expected_revision+1 or v_h.cliente_novo is distinct from p_cliente_id or v_h.motivo is distinct from btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('envelopeId',v_h.envelope_id,'clienteId',v_h.cliente_novo,'revision',v_h.revisao,'requestId',p_request_id,'eventoAplicado',false);
  end if;
  if config.sso_autorizar_triagem_global() is not true or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from pcm.origem_campo_inbox where id=p_envelope_id for update;
  if not found or exists(select 1 from pcm.origem_campo_resolucoes where envelope_id=p_envelope_id and resultado='os_identificada') then raise exception 'envelope_indisponivel' using errcode='23514'; end if;
  select * into v_t from pcm.sso_origem_campo_triagens where envelope_id=p_envelope_id for update;
  if not found or config.sso_autorizar_acao('integracao.reconciliar',v_t.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if v_t.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if v_t.cliente_id=p_cliente_id then raise exception 'cliente_inalterado' using errcode='22023'; end if;
  v_anterior:=v_t.cliente_id;
  update pcm.sso_origem_campo_triagens set cliente_id=p_cliente_id,motivo=btrim(p_motivo),ator_id=v_ator,revisao=revisao+1 where envelope_id=p_envelope_id returning * into v_t;
  insert into pcm.sso_origem_campo_triagem_historico(envelope_id,revisao,cliente_anterior,cliente_novo,motivo,ator_id,request_id) values(p_envelope_id,v_t.revisao,v_anterior,p_cliente_id,btrim(p_motivo),v_ator,p_request_id);
  v_resultado:=jsonb_build_object('envelopeId',p_envelope_id,'clienteId',p_cliente_id,'revision',v_t.revisao,'requestId',p_request_id,'eventoAplicado',false);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'origem_campo.cliente_retificado','origem_campo_inbox',p_envelope_id,v_resultado||jsonb_build_object('clienteAnterior',v_anterior,'motivo',btrim(p_motivo)));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_retificar_cliente_origem_campo(uuid,uuid,integer,uuid,text) from public,anon,authenticated,service_role;

create function pcm.sso_consultar_tentativa_triagem(p_request_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_h pcm.sso_origem_campo_triagem_historico%rowtype;
begin
  if p_request_id is null or config.sso_autorizar_triagem_global() is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_h from pcm.sso_origem_campo_triagem_historico where request_id=p_request_id and ator_id=auth.uid();
  if not found or config.sso_autorizar_acao('integracao.reconciliar',v_h.cliente_novo) is not true or (v_h.cliente_anterior is not null and config.sso_autorizar_acao('integracao.reconciliar',v_h.cliente_anterior) is not true) then raise exception 'tentativa_indisponivel' using errcode='42501'; end if;
  return jsonb_build_object('envelopeId',v_h.envelope_id,'clienteId',v_h.cliente_novo,'revision',v_h.revisao,'requestId',v_h.request_id,'eventoAplicado',false);
end;
$$;
revoke all on function pcm.sso_consultar_tentativa_triagem(uuid) from public,anon,authenticated,service_role;

create function pcm.sso_listar_triagens_campo(p_apos uuid,p_limite integer)
returns table(envelope_id uuid,cliente_id uuid,revisao integer,motivo text,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_triagem_global() is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select t.envelope_id,t.cliente_id,t.revisao,t.motivo,t.criado_em from pcm.sso_origem_campo_triagens t
    where (p_apos is null or t.envelope_id>p_apos) and config.sso_autorizar_acao('integracao.reconciliar',t.cliente_id) is true
      and not exists(select 1 from pcm.origem_campo_resolucoes r where r.envelope_id=t.envelope_id and r.resultado='os_identificada')
    order by t.envelope_id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_triagens_campo(uuid,integer) from public,anon,authenticated,service_role;
