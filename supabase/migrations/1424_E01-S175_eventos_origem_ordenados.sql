-- ADR-1276: histórico privado, sem acesso operacional ou atualização de OS.
create table pcm.sso_origem_campo_eventos(
  integracao text not null,task_id bigint not null,envelope_id uuid not null references pcm.origem_campo_inbox(id),
  contrato_id uuid not null references pcm.sso_contratos_origem_campo(id),ordem_externa bigint not null check(ordem_externa>0),
  projecao jsonb not null,estado text not null check(estado in ('aceito','atrasado','conflito_regressao')),
  criado_em timestamptz not null default now(),primary key(integracao,task_id,ordem_externa),
  foreign key(integracao,task_id) references pcm.sso_origem_campo_processamentos(integracao,task_id)
);
alter table pcm.sso_origem_campo_eventos enable row level security;
alter table pcm.sso_origem_campo_eventos force row level security;
revoke all on pcm.sso_origem_campo_eventos from public,anon,authenticated,service_role;
create trigger sso_origem_campo_eventos_imutaveis before update or delete on pcm.sso_origem_campo_eventos
  for each row execute function pcm.sso_proteger_conferencia_levantamento();
create trigger sso_conferir_evento_origem before insert on pcm.sso_origem_campo_eventos
  for each row execute function pcm.sso_conferir_projecao_origem();

create function pcm.sso_registrar_primeiro_evento_origem() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into pcm.sso_origem_campo_eventos(integracao,task_id,envelope_id,contrato_id,ordem_externa,projecao,estado)
    values(new.integracao,new.task_id,new.envelope_id,new.contrato_id,(new.projecao->>'ordemExterna')::bigint,new.projecao,'aceito');
  return new;
end; $$;
revoke all on function pcm.sso_registrar_primeiro_evento_origem() from public,anon,authenticated,service_role;
create trigger sso_registrar_primeiro_evento_origem after insert on pcm.sso_origem_campo_processamentos
  for each row execute function pcm.sso_registrar_primeiro_evento_origem();

create function pcm.sso_registrar_evento_origem(p_envelope_id uuid,p_contrato_id uuid,p_projecao jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare e pcm.origem_campo_inbox%rowtype; atual pcm.sso_origem_campo_eventos%rowtype; ant pcm.sso_origem_campo_eventos%rowtype;
  processamento pcm.sso_origem_campo_processamentos%rowtype; ordem bigint; estado text; novo text; anterior text;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if coalesce(auth.role(),'')<>'service_role' or p_envelope_id is null or p_contrato_id is null or jsonb_typeof(p_projecao) is distinct from 'object'
    or coalesce(p_projecao->>'ordemExterna','') !~ '^[1-9][0-9]{0,17}$' or p_projecao->>'statusCampo' not in ('aberta','em_andamento','concluida') then
    raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform 1 from pcm.sso_processamento_origem_gate where id and habilitado for share;
  if not found then raise exception 'processamento_desabilitado' using errcode='55000'; end if;
  perform 1 from pcm.origem_campo_inbox_gate where id and habilitado for share;
  if not found then raise exception 'inbox_desabilitada' using errcode='55000'; end if;
  select * into e from pcm.origem_campo_inbox where id=p_envelope_id and integracao='auvo' for update;
  if not found then raise exception 'envelope_indisponivel' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-origem-campo-tarefa:'||e.task_id::text,0));
  select * into processamento from pcm.sso_origem_campo_processamentos where integracao='auvo' and task_id=e.task_id for share;
  if not found then raise exception 'processamento_inicial_ausente' using errcode='23514'; end if;
  ordem:=(p_projecao->>'ordemExterna')::bigint;
  select * into ant from pcm.sso_origem_campo_eventos where integracao='auvo' and task_id=e.task_id and ordem_externa=ordem;
  if found then
    if ant.projecao is distinct from p_projecao or ant.contrato_id is distinct from p_contrato_id then
      perform pcm.sso_observar_entrega_origem(e.id,p_contrato_id,processamento.os_id,'conflito_ordem');
      return jsonb_build_object('estado','conflito','motivo','mesma_ordem_conteudo_divergente','envelopeId',e.id,'osId',processamento.os_id,'eventoAplicado',false);
    end if;
    perform pcm.sso_observar_entrega_origem(e.id,p_contrato_id,processamento.os_id,'repetido');
    return jsonb_build_object('estado',ant.estado,'envelopeId',e.id,'osId',processamento.os_id,'ordemExterna',ordem::text,'reutilizado',true,'osAlterada',false,'validacaoPcmComprovada',false);
  end if;
  select * into atual from pcm.sso_origem_campo_eventos where integracao='auvo' and task_id=e.task_id and estado='aceito' order by ordem_externa desc limit 1;
  if not found then raise exception 'historico_indisponivel' using errcode='23514'; end if;
  novo:=p_projecao->>'statusCampo'; anterior:=atual.projecao->>'statusCampo';
  if ordem<atual.ordem_externa then estado:='atrasado';
  elsif (anterior='concluida' and novo<>'concluida') or (anterior='em_andamento' and novo='aberta') then estado:='conflito_regressao';
  else estado:='aceito'; end if;
  insert into pcm.sso_origem_campo_eventos(integracao,task_id,envelope_id,contrato_id,ordem_externa,projecao,estado)
    values('auvo',e.task_id,e.id,p_contrato_id,ordem,p_projecao,estado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(null,'origem_campo.evento_registrado','ordens_servico',processamento.os_id,
    jsonb_build_object('envelopeId',e.id,'ordemExterna',ordem::text,'estado',estado));
  return jsonb_build_object('estado',estado,'envelopeId',e.id,'osId',processamento.os_id,'ordemExterna',ordem::text,'reutilizado',false,'osAlterada',false,'validacaoPcmComprovada',false);
end; $$;
revoke all on function pcm.sso_registrar_evento_origem(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
