-- ADR-1467: aplicação preparada, exclusivamente por serviço e com gate fechado.
create table pcm.sso_aplicacao_evento_campo_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
insert into pcm.sso_aplicacao_evento_campo_gate(id, habilitado) values (true, false);
create table pcm.sso_versoes_os_origem_campo (
  os_id uuid primary key references pcm.ordens_servico(id),
  integracao text not null, task_id bigint not null,
  revisao bigint not null default 0 check (revisao >= 0),
  revisao_aplicada bigint not null default 0 check (revisao_aplicada >= 0),
  ultima_ordem bigint not null check (ultima_ordem > 0),
  foreign key (integracao, task_id) references pcm.sso_origem_campo_processamentos(integracao, task_id),
  check (revisao_aplicada <= revisao)
);
create table pcm.sso_eventos_campo_aplicados (
  integracao text not null, task_id bigint not null, ordem_externa bigint not null,
  os_id uuid not null references pcm.ordens_servico(id), cliente_id uuid not null references pcm.clientes(id),
  envelope_id uuid not null references pcm.origem_campo_inbox(id), resultado jsonb not null,
  criado_em timestamptz not null default now(),
  primary key (integracao, task_id, ordem_externa),
  foreign key (integracao, task_id, ordem_externa) references pcm.sso_origem_campo_eventos(integracao, task_id, ordem_externa)
);
alter table pcm.sso_aplicacao_evento_campo_gate enable row level security;
alter table pcm.sso_aplicacao_evento_campo_gate force row level security;
alter table pcm.sso_versoes_os_origem_campo enable row level security;
alter table pcm.sso_versoes_os_origem_campo force row level security;
alter table pcm.sso_eventos_campo_aplicados enable row level security;
alter table pcm.sso_eventos_campo_aplicados force row level security;
revoke all on pcm.sso_aplicacao_evento_campo_gate, pcm.sso_versoes_os_origem_campo, pcm.sso_eventos_campo_aplicados from public, anon, authenticated, service_role;
create trigger sso_eventos_campo_aplicados_imutaveis before update or delete on pcm.sso_eventos_campo_aplicados
  for each row execute function pcm.sso_proteger_conferencia_levantamento();

-- Apenas criações novas feitas pelo processador possuem fotografia inicial confiável.
create function pcm.sso_iniciar_versao_os_origem_campo() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.motivo in ('referencia_ausente', 'referencia_invalida_ou_outro_cliente', 'referencia_chamado') then
    insert into pcm.sso_versoes_os_origem_campo(os_id,integracao,task_id,ultima_ordem)
      values(new.os_id,new.integracao,new.task_id,(new.projecao->>'ordemExterna')::bigint);
  end if;
  return new;
end; $$;
revoke all on function pcm.sso_iniciar_versao_os_origem_campo() from public,anon,authenticated,service_role;
create trigger sso_iniciar_versao_os_origem_campo after insert on pcm.sso_origem_campo_processamentos
  for each row execute function pcm.sso_iniciar_versao_os_origem_campo();

-- Toda atualização, inclusive de outros escritores, invalida a fotografia anterior.
create function pcm.sso_incrementar_versao_os_origem_campo() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update pcm.sso_versoes_os_origem_campo set revisao=revisao+1 where os_id=new.id;
  return new;
end; $$;
revoke all on function pcm.sso_incrementar_versao_os_origem_campo() from public,anon,authenticated,service_role;
create trigger sso_incrementar_versao_os_origem_campo after update on pcm.ordens_servico
  for each row execute function pcm.sso_incrementar_versao_os_origem_campo();

create function pcm.sso_aplicar_evento_origem_campo(p_envelope_id uuid,p_ordem bigint)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  e pcm.origem_campo_inbox%rowtype; p pcm.sso_origem_campo_processamentos%rowtype;
  ev pcm.sso_origem_campo_eventos%rowtype; v pcm.sso_versoes_os_origem_campo%rowtype;
  o pcm.ordens_servico%rowtype; anterior pcm.sso_eventos_campo_aplicados%rowtype;
  tecnico uuid; tecnico_externo bigint; tecnicos bigint; resultado jsonb; sync_anterior text;
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.role() is distinct from 'service_role' or p_envelope_id is null or p_ordem is null or p_ordem<1 then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from pcm.sso_aplicacao_evento_campo_gate where id and habilitado for share;
  if not found then raise exception 'aplicacao_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_processamento_origem_gate where id and habilitado for share;
  if not found then raise exception 'processamento_desabilitado' using errcode='55000'; end if;
  perform 1 from pcm.origem_campo_inbox_gate where id and habilitado for share;
  if not found then raise exception 'inbox_desabilitada' using errcode='55000'; end if;
  select * into e from pcm.origem_campo_inbox where id=p_envelope_id and integracao='auvo' for update;
  if not found then raise exception 'envelope_indisponivel' using errcode='23514'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-origem-campo-tarefa:'||e.task_id::text,0));
  select * into p from pcm.sso_origem_campo_processamentos where integracao=e.integracao and task_id=e.task_id for share;
  if not found then raise exception 'processamento_inicial_ausente' using errcode='23514'; end if;
  perform 1 from pcm.clientes where id=p.cliente_id and deleted_at is null and auvo_id::text=e.cliente_externo_id for share;
  if not found or (select count(*) from pcm.clientes where deleted_at is null and auvo_id::text=e.cliente_externo_id)<>1 then
    return jsonb_build_object('estado','pendente','motivo','cliente_externo_divergente','envelopeId',e.id,'ordemExterna',p_ordem::text);
  end if;
  select * into o from pcm.ordens_servico where id=p.os_id and client_id=p.cliente_id and auvo_task_id=e.task_id and deleted_at is null for update;
  if not found then return jsonb_build_object('estado','pendente','motivo','os_ou_cliente_divergente','envelopeId',e.id,'ordemExterna',p_ordem::text); end if;
  select * into ev from pcm.sso_origem_campo_eventos where integracao=e.integracao and task_id=e.task_id and ordem_externa=p_ordem and estado='aceito';
  if not found then return jsonb_build_object('estado','pendente','motivo','evento_nao_aceito','envelopeId',e.id,'ordemExterna',p_ordem::text); end if;
  if ev.contrato_id is distinct from p.contrato_id then return jsonb_build_object('estado','pendente','motivo','contrato_alterado_exige_conferencia','envelopeId',e.id,'ordemExterna',p_ordem::text); end if;
  perform 1 from pcm.sso_contratos_origem_campo where id=ev.contrato_id and integracao=e.integracao and habilitado for share;
  if not found then return jsonb_build_object('estado','pendente','motivo','contrato_desabilitado','envelopeId',e.id,'ordemExterna',p_ordem::text); end if;
  select * into anterior from pcm.sso_eventos_campo_aplicados where integracao=e.integracao and task_id=e.task_id and ordem_externa=p_ordem;
  if found then return anterior.resultado || jsonb_build_object('envelopeId',e.id,'reutilizado',true); end if;
  if exists(select 1 from pcm.sso_origem_campo_eventos x where x.integracao=e.integracao and x.task_id=e.task_id and x.estado='aceito' and x.ordem_externa>p_ordem) then
    return jsonb_build_object('estado','pendente','motivo','evento_desatualizado','envelopeId',e.id,'ordemExterna',p_ordem::text);
  end if;
  select * into v from pcm.sso_versoes_os_origem_campo where os_id=o.id and integracao=e.integracao and task_id=e.task_id for update;
  if not found then return jsonb_build_object('estado','pendente','motivo','os_preexistente_ou_sem_fotografia','envelopeId',e.id,'ordemExterna',p_ordem::text); end if;
  if p_ordem<=v.ultima_ordem then return jsonb_build_object('estado','pendente','motivo','evento_ja_contemplado','envelopeId',e.id,'ordemExterna',p_ordem::text); end if;
  if v.revisao<>v.revisao_aplicada then return jsonb_build_object('estado','pendente','motivo','os_alterada_exige_conferencia','envelopeId',e.id,'ordemExterna',p_ordem::text); end if;
  if ev.projecao->>'tecnicoAuvoId' is not null then
    tecnico_externo:=(ev.projecao->>'tecnicoAuvoId')::bigint;
    select count(*),min(f.id::text)::uuid into tecnicos,tecnico from pcm.funcionarios f where f.auvo_user_id=tecnico_externo and f.deleted_at is null;
    if tecnicos>1 then return jsonb_build_object('estado','pendente','motivo','tecnico_ambiguo','envelopeId',e.id,'ordemExterna',p_ordem::text); end if;
  end if;
  sync_anterior:=current_setting('app.auvo_sync_write',true);
  perform pg_catalog.set_config('app.auvo_sync_write','true',true);
  update pcm.ordens_servico set titulo=ev.projecao->>'titulo', descricao=ev.projecao->>'descricao',
    tecnico_auvo_user_id=tecnico_externo, tecnico_funcionario_id=tecnico,
    data_agendada=nullif(ev.projecao->>'dataAgendada','')::timestamptz,
    check_in_at=nullif(ev.projecao->>'checkIn','')::timestamptz, check_out_at=nullif(ev.projecao->>'checkOut','')::timestamptz,
    auvo_detalhes=nullif(ev.projecao->'detalhes','null'::jsonb), updated_at=now()
    where id=o.id;
  perform pg_catalog.set_config('app.auvo_sync_write',coalesce(sync_anterior,''),true);
  update pcm.sso_versoes_os_origem_campo set revisao_aplicada=revisao,ultima_ordem=p_ordem where os_id=o.id;
  resultado:=jsonb_build_object('estado','aplicado','envelopeId',e.id,'osId',o.id,'clienteId',p.cliente_id,
    'ordemExterna',p_ordem::text,'reutilizado',false,'validacaoPcmComprovada',false,'chamadoAlterado',false);
  insert into pcm.sso_eventos_campo_aplicados(integracao,task_id,ordem_externa,os_id,cliente_id,envelope_id,resultado)
    values(e.integracao,e.task_id,p_ordem,o.id,p.cliente_id,e.id,resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(null,'origem_campo.evento_aplicado','ordens_servico',o.id,
    jsonb_build_object('envelopeId',e.id,'ordemExterna',p_ordem::text,'clienteId',p.cliente_id));
  return resultado;
end; $$;
revoke all on function pcm.sso_aplicar_evento_origem_campo(uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_aplicar_evento_origem_campo(uuid,bigint) to service_role;
