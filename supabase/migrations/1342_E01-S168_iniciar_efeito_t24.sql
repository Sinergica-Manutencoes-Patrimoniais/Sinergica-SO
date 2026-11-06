-- ADR-1175: início privado sem agendamento, rede ou concessão de execução.
create table pcm.sso_t24_execucao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_t24_execucao_gate(id,habilitado) values(true,false);
create table pcm.sso_t24_inicio_recibos(request_id uuid primary key,tentativa_id uuid not null references pcm.sso_t24_tentativas(id),
 fence bigint not null check(fence>0),criado_em timestamptz not null default now(),unique(tentativa_id,fence));
alter table pcm.sso_t24_execucao_gate enable row level security;alter table pcm.sso_t24_execucao_gate force row level security;
alter table pcm.sso_t24_inicio_recibos enable row level security;alter table pcm.sso_t24_inicio_recibos force row level security;
revoke all on pcm.sso_t24_execucao_gate,pcm.sso_t24_inicio_recibos from public,anon,authenticated,service_role;
create trigger sso_t24_inicio_recibos_imutaveis before update or delete on pcm.sso_t24_inicio_recibos
 for each row execute function pcm.sso_proteger_nota_reconciliacao();
create function pcm.sso_t24_iniciar_efeito(p_request_id uuid,p_tentativa_id uuid,p_fence bigint)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare t pcm.sso_t24_tentativas%rowtype;q pcm.auvo_sync_outbox%rowtype;r pcm.sso_t24_inicio_recibos%rowtype;
 v_outbox uuid;v_protocolo text;v_seq bigint;v_agora timestamptz;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.role() is distinct from 'service_role' or p_request_id is null or p_tentativa_id is null or p_fence is null or p_fence not between 1 and 9007199254740991 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform 1 from pcm.sso_t24_execucao_gate where id and habilitado for share;
 if not found then raise exception 'execucao_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_t24_reserva_gate where id and habilitado for share;
 if not found then raise exception 'reserva_desabilitada' using errcode='55000'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-t24-inicio:'||p_request_id::text,0));
 select * into r from pcm.sso_t24_inicio_recibos where request_id=p_request_id;
 if found then
  if r.tentativa_id<>p_tentativa_id or r.fence<>p_fence then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  return jsonb_build_object('requestId',p_request_id,'tentativaId',p_tentativa_id,'fence',p_fence,'autorizaEnvio',false,'resultadoIncerto',true);
 end if;
 select outbox_id into v_outbox from pcm.sso_t24_tentativas where id=p_tentativa_id;
 if v_outbox is null then raise exception 'outbox_indisponivel' using errcode='42501'; end if;
 select * into q from pcm.auvo_sync_outbox where id=v_outbox for update;
 if not found then raise exception 'outbox_indisponivel' using errcode='40001'; end if;
 select * into t from pcm.sso_t24_tentativas where id=p_tentativa_id and outbox_id=q.id for update;
 v_agora:=clock_timestamp();
 if not found or t.fence<>p_fence or t.estado<>'reservado' or t.reservado_ate<=v_agora or t.elegivel_em>v_agora
  or q.entity<>'ordens_servico_t24' or q.row_id<>t.os_id or q.status<>'processing'
  or q.op<>(case t.operacao when 'criar' then 'create' else 'update' end) then raise exception 'reserva_obsoleta' using errcode='40001'; end if;
 select protocolo into v_protocolo from pcm.sso_t24_produtor_recibos where tentativa_id=t.id and cliente_id=t.cliente_id;
 if v_protocolo not in ('preventiva','corretiva') or v_protocolo is null then raise exception 'origem_nao_comprovada' using errcode='23514'; end if;
 if not pcm.sso_t24_autorizar_ator_atual(t.id) or not pcm.sso_t24_ciencia_atual(t.id) then raise exception 'autorizacao_ou_ciencia_indisponivel' using errcode='42501'; end if;
 if v_protocolo='preventiva' then
  perform 1 from pcm.preventiva_auvo_contrato where id and estado='validado' for share nowait;
  if not found or not pcm.sso_t24_fontes_preventivas_atuais(t.id) then raise exception 'fontes_preventivas_indisponiveis' using errcode='23514'; end if;
 else
  perform 1 from pcm.sso_t24_contrato_corretiva_gate where id and habilitado for share nowait;
  if not found or not pcm.sso_t24_fontes_corretivas_atuais(t.id) then raise exception 'fontes_corretivas_indisponiveis' using errcode='23514'; end if;
 end if;
 -- Uma validação longa não pode usar lease vencido para começar efeito.
 if t.reservado_ate<=clock_timestamp() then raise exception 'reserva_expirada' using errcode='40001'; end if;
 update pcm.sso_t24_tentativas set estado='iniciado',reservado_ate=null,efeito_iniciado_em=clock_timestamp(),atualizado_em=clock_timestamp() where id=t.id;
 select coalesce(max(sequencia),0)+1 into v_seq from pcm.sso_t24_tentativa_eventos where tentativa_id=t.id;
 insert into pcm.sso_t24_tentativa_eventos(tentativa_id,sequencia,fence,estado,motivo) values(t.id,v_seq,t.fence,'iniciado','efeito_iniciado');
 insert into pcm.sso_t24_inicio_recibos(request_id,tentativa_id,fence) values(p_request_id,t.id,p_fence);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(null,'integracao.t24_inicio','sso_t24_tentativas',t.id,jsonb_build_object('requestId',p_request_id,'fence',p_fence));
 return jsonb_build_object('requestId',p_request_id,'tentativaId',t.id,'fence',p_fence,'autorizaEnvio',true,'resultadoIncerto',false);
end; $$;
revoke all on function pcm.sso_t24_iniciar_efeito(uuid,uuid,bigint) from public,anon,authenticated,service_role;
