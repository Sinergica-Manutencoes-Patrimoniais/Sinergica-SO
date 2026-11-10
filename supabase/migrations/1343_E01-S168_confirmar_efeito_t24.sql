-- ADR-1176: comando privado, sem concessão, agendamento ou rede.
create table pcm.sso_t24_confirmacao_recibos(request_id uuid primary key,tentativa_id uuid not null references pcm.sso_t24_tentativas(id),
 fence bigint not null check(fence>0),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now(),unique(tentativa_id,fence));
alter table pcm.sso_t24_confirmacao_recibos enable row level security;alter table pcm.sso_t24_confirmacao_recibos force row level security;
revoke all on pcm.sso_t24_confirmacao_recibos from public,anon,authenticated,service_role;
create trigger sso_t24_confirmacao_recibos_imutaveis before update or delete on pcm.sso_t24_confirmacao_recibos
 for each row execute function pcm.sso_proteger_nota_reconciliacao();
create function pcm.sso_t24_confirmar_efeito(p_request_id uuid,p_tentativa_id uuid,p_fence bigint,p_tarefa_id text,p_observado jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare t pcm.sso_t24_tentativas%rowtype;q pcm.auvo_sync_outbox%rowtype;o pcm.ordens_servico%rowtype;
 anterior pcm.sso_t24_confirmacao_recibos%rowtype;v_outbox uuid;v_protocolo text;payload jsonb;resultado jsonb;v_seq bigint;v_tarefa bigint;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.role() is distinct from 'service_role' or p_request_id is null or p_tentativa_id is null or p_fence is null or p_fence not between 1 and 9007199254740991
  or p_tarefa_id is null or p_tarefa_id !~ '^[1-9][0-9]{0,18}$' or jsonb_typeof(p_observado) is distinct from 'object'
  or octet_length(p_observado::text)>8192 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 begin v_tarefa:=p_tarefa_id::bigint;exception when numeric_value_out_of_range then raise exception 'tarefa_invalida' using errcode='22023';end;
 perform 1 from pcm.sso_t24_execucao_gate where id and habilitado for share;
 if not found then raise exception 'execucao_desabilitada' using errcode='55000'; end if;
 payload:=jsonb_build_object('tentativaId',p_tentativa_id,'fence',p_fence,'tarefaId',p_tarefa_id,'observado',p_observado);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-t24-confirmar:'||p_request_id::text,0));
 select * into anterior from pcm.sso_t24_confirmacao_recibos where request_id=p_request_id;
 if found then if anterior.payload is distinct from payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return anterior.resultado;end if;
 select outbox_id into v_outbox from pcm.sso_t24_tentativas where id=p_tentativa_id;
 if v_outbox is null then raise exception 'outbox_indisponivel' using errcode='42501'; end if;
 select * into q from pcm.auvo_sync_outbox where id=v_outbox for update;
 if not found then raise exception 'outbox_indisponivel' using errcode='40001'; end if;
 select * into t from pcm.sso_t24_tentativas where id=p_tentativa_id and outbox_id=q.id for update;
 if not found or t.estado<>'iniciado' or t.fence<>p_fence or q.entity<>'ordens_servico_t24' or q.row_id<>t.os_id or q.status<>'processing'
  or q.op<>(case t.operacao when 'criar' then 'create' else 'update' end) then raise exception 'tentativa_obsoleta' using errcode='40001'; end if;
 if p_observado is distinct from (t.esperado||jsonb_build_object('tarefaId',p_tarefa_id)) then raise exception 'leitura_divergente' using errcode='23514'; end if;
 if t.operacao='atualizar' and t.tarefa_id is distinct from p_tarefa_id then raise exception 'tarefa_divergente' using errcode='23514'; end if;
 select protocolo into v_protocolo from pcm.sso_t24_produtor_recibos where tentativa_id=t.id and cliente_id=t.cliente_id;
 if v_protocolo is null or not pcm.sso_t24_autorizar_ator_atual(t.id) or not pcm.sso_t24_ciencia_atual(t.id) then raise exception 'autorizacao_ou_ciencia_indisponivel' using errcode='42501'; end if;
 if v_protocolo='preventiva' then
  perform 1 from pcm.preventiva_auvo_contrato where id and estado='validado' for share nowait;
  if not found or not pcm.sso_t24_fontes_preventivas_atuais(t.id) then raise exception 'fontes_indisponiveis' using errcode='23514'; end if;
 elsif v_protocolo='corretiva' then
  perform 1 from pcm.sso_t24_contrato_corretiva_gate where id and habilitado for share nowait;
  if not found or not pcm.sso_t24_fontes_corretivas_atuais(t.id) then raise exception 'fontes_indisponiveis' using errcode='23514'; end if;
 else raise exception 'protocolo_indisponivel' using errcode='23514'; end if;
 select * into o from pcm.ordens_servico where id=t.os_id and client_id=t.cliente_id and deleted_at is null for update nowait;
 if not found or (t.operacao='criar' and o.auvo_task_id is not null) or (t.operacao='atualizar' and o.auvo_task_id is distinct from v_tarefa) then raise exception 'identidade_os_alterada' using errcode='40001'; end if;
 update pcm.ordens_servico set auvo_task_id=v_tarefa,auvo_sync_status='synced',auvo_sync_error=null,auvo_synced_at=clock_timestamp() where id=o.id;
 update pcm.sso_t24_tentativas set estado='confirmado',tarefa_observada=p_tarefa_id,atualizado_em=clock_timestamp() where id=t.id;
 update pcm.auvo_sync_outbox set status='sent',last_error=null,sent_at=clock_timestamp() where id=q.id;
 select coalesce(max(sequencia),0)+1 into v_seq from pcm.sso_t24_tentativa_eventos where tentativa_id=t.id;
 insert into pcm.sso_t24_tentativa_eventos(tentativa_id,sequencia,fence,estado,motivo) values(t.id,v_seq,t.fence,'confirmado','leitura_compativel');
 resultado:=jsonb_build_object('requestId',p_request_id,'tentativaId',t.id,'fence',t.fence,'tarefaId',p_tarefa_id,'estado','confirmado');
 insert into pcm.sso_t24_confirmacao_recibos(request_id,tentativa_id,fence,payload,resultado) values(p_request_id,t.id,t.fence,payload,resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(null,'integracao.t24_confirmada','ordens_servico',o.id,jsonb_build_object('requestId',p_request_id,'tentativaId',t.id,'fence',t.fence,'tarefaId',p_tarefa_id));
 return resultado;
end; $$;
revoke all on function pcm.sso_t24_confirmar_efeito(uuid,uuid,bigint,text,jsonb) from public,anon,authenticated,service_role;
