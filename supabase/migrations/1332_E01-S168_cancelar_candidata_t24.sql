-- ADR-1165: cancelamento local, sem chamada externa.
create table pcm.sso_t24_cancelamento_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_t24_cancelamento_gate(id,habilitado) values(true,false);
create table pcm.sso_t24_cancelamento_recibos(request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),
 tentativa_id uuid not null references pcm.sso_t24_tentativas(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now());
alter table pcm.sso_t24_cancelamento_gate enable row level security;alter table pcm.sso_t24_cancelamento_gate force row level security;
alter table pcm.sso_t24_cancelamento_recibos enable row level security;alter table pcm.sso_t24_cancelamento_recibos force row level security;
revoke all on pcm.sso_t24_cancelamento_gate,pcm.sso_t24_cancelamento_recibos from public,anon,authenticated,service_role;
create trigger sso_t24_cancelamento_recibos_imutaveis before update or delete on pcm.sso_t24_cancelamento_recibos
 for each row execute function pcm.sso_proteger_nota_reconciliacao();
create function pcm.sso_t24_cancelar_candidata(p_request_id uuid,p_cliente_id uuid,p_tentativa_id uuid,p_fence bigint,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_outbox uuid;q pcm.auvo_sync_outbox%rowtype;t pcm.sso_t24_tentativas%rowtype;
 anterior pcm.sso_t24_cancelamento_recibos%rowtype;v_payload jsonb;v_resultado jsonb;v_seq bigint;v_estado text;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if v_ator is null or p_request_id is null or p_cliente_id is null or p_tentativa_id is null or p_fence is null or p_fence<0
  or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_t24_cancelamento_gate where id and habilitado for share;
 if not found then raise exception 'cancelamento_desabilitado' using errcode='55000'; end if;
 if config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'tentativaId',p_tentativa_id,'fence',p_fence,'motivo',btrim(p_motivo));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-t24-cancelar:'||p_request_id::text,0));
 select * into anterior from pcm.sso_t24_cancelamento_recibos where request_id=p_request_id;
 if found then
  if anterior.ator_id is distinct from v_ator or anterior.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  return anterior.resultado;
 end if;
 select outbox_id into v_outbox from pcm.sso_t24_tentativas where id=p_tentativa_id and cliente_id=p_cliente_id;
 if v_outbox is null then raise exception 'tentativa_indisponivel' using errcode='42501'; end if;
 select * into q from pcm.auvo_sync_outbox where id=v_outbox for update;
 if not found then raise exception 'fila_indisponivel' using errcode='40001'; end if;
 select * into t from pcm.sso_t24_tentativas where id=p_tentativa_id and cliente_id=p_cliente_id and outbox_id=q.id for update;
 if not found or q.entity<>'ordens_servico_t24' or q.row_id<>t.os_id or t.fence<>p_fence
  or q.op<>(case t.operacao when 'criar' then 'create' else 'update' end) then raise exception 'tentativa_obsoleta' using errcode='40001'; end if;
 -- Não esperar com outbox/livro travados caso escritor de OS ou Visita tenha ordem inversa.
 perform 1 from pcm.visitas where id=t.visita_id and cliente_id=p_cliente_id for share nowait;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 perform 1 from pcm.ordens_servico where id=t.os_id and client_id=p_cliente_id and deleted_at is null for share nowait;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 if config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if t.estado not in ('aguardando','reservado','iniciado') or q.status not in ('pending','processing') then raise exception 'reconciliacao_ou_estado_incompativel' using errcode='23514'; end if;
 if t.fence>=9007199254740991 then raise exception 'fence_esgotado' using errcode='22003'; end if;
 v_estado:=case when t.estado='iniciado' then 'incerto' else 'cancelado' end;
 update pcm.auvo_sync_outbox set status='error',last_error='t24_cancelamento_local_requer_conferencia',sent_at=null where id=q.id;
 update pcm.sso_t24_tentativas set estado=v_estado,fence=fence+1,reservado_ate=null,atualizado_em=clock_timestamp() where id=t.id returning * into t;
 select coalesce(max(sequencia),0)+1 into v_seq from pcm.sso_t24_tentativa_eventos where tentativa_id=t.id;
 insert into pcm.sso_t24_tentativa_eventos(tentativa_id,sequencia,fence,estado,motivo) values(t.id,v_seq,t.fence,v_estado,'cancelamento_local');
 v_resultado:=jsonb_build_object('requestId',p_request_id,'tentativaId',t.id,'fence',t.fence,'estado',v_estado,'efeitoRemotoComprovado',false);
 insert into pcm.sso_t24_cancelamento_recibos(request_id,ator_id,cliente_id,tentativa_id,payload,resultado) values(p_request_id,v_ator,p_cliente_id,t.id,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'integracao.t24_cancelamento_local','sso_t24_tentativas',t.id,v_resultado||jsonb_build_object('motivo',btrim(p_motivo)));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_t24_cancelar_candidata(uuid,uuid,uuid,bigint,text) from public,anon,authenticated,service_role;
