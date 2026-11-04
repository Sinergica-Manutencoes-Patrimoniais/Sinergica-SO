-- ADR-1142: resultados conservadores; nenhuma confirmação de sucesso remoto.
alter table pcm.sso_t24_tentativas add column tarefa_observada text
 check(tarefa_observada is null or (tarefa_observada=btrim(tarefa_observada) and length(tarefa_observada) between 1 and 200));
create table pcm.sso_t24_resultado_recibos(
 request_id uuid primary key,tentativa_id uuid not null references pcm.sso_t24_tentativas(id),fence bigint not null check(fence>0),
 payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now(),unique(tentativa_id,fence)
);
alter table pcm.sso_t24_resultado_recibos enable row level security;
alter table pcm.sso_t24_resultado_recibos force row level security;
revoke all on pcm.sso_t24_resultado_recibos from public,anon,authenticated,service_role;
create trigger sso_t24_resultado_recibos_imutaveis before update or delete on pcm.sso_t24_resultado_recibos
 for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function pcm.sso_t24_registrar_resultado_conservador(p_request_id uuid,p_tentativa_id uuid,p_fence bigint,p_estado text,p_tarefa_observada text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v pcm.sso_t24_tentativas%rowtype;v_anterior pcm.sso_t24_resultado_recibos%rowtype;v_payload jsonb;v_resultado jsonb;v_seq bigint;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'servico_nao_autorizado' using errcode='42501'; end if;
 if p_request_id is null or p_tentativa_id is null or p_fence is null or p_fence not between 1 and 9007199254740991
  or p_estado is null or p_estado not in ('bloqueado','incerto','reconciliacao')
  or p_motivo is null or p_motivo !~ '^[a-z0-9_]{1,120}$'
  or (p_tarefa_observada is not null and (p_tarefa_observada<>btrim(p_tarefa_observada) or length(p_tarefa_observada) not between 1 and 200))
  then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform 1 from pcm.sso_t24_reserva_gate where id and habilitado for share;
 if not found then raise exception 'reserva_desabilitada' using errcode='55000'; end if;
 v_payload:=jsonb_build_object('tentativaId',p_tentativa_id,'fence',p_fence,'estado',p_estado,'tarefaObservada',p_tarefa_observada,'motivo',p_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-t24-resultado:'||p_request_id::text,0));
 select * into v from pcm.sso_t24_tentativas where id=p_tentativa_id for update;
 if not found then raise exception 'tentativa_indisponivel' using errcode='42501'; end if;
 select * into v_anterior from pcm.sso_t24_resultado_recibos where request_id=p_request_id;
 if found then
  if v_anterior.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  return v_anterior.resultado;
 end if;
 if v.fence is distinct from p_fence or v.estado not in ('reservado','iniciado')
  or (v.estado='reservado' and v.reservado_ate<=clock_timestamp())
  or (p_estado='bloqueado' and v.estado<>'reservado') then raise exception 'tentativa_obsoleta' using errcode='40001'; end if;
 update pcm.sso_t24_tentativas set estado=p_estado,reservado_ate=null,tarefa_observada=p_tarefa_observada,atualizado_em=clock_timestamp() where id=v.id;
 select coalesce(max(sequencia),0)+1 into v_seq from pcm.sso_t24_tentativa_eventos where tentativa_id=v.id;
 insert into pcm.sso_t24_tentativa_eventos(tentativa_id,sequencia,fence,estado,motivo) values(v.id,v_seq,v.fence,p_estado,p_motivo);
 v_resultado:=jsonb_build_object('requestId',p_request_id,'tentativaId',v.id,'fence',v.fence,'estado',p_estado,'tarefaObservada',p_tarefa_observada,'efeitoRemotoComprovado',false);
 insert into pcm.sso_t24_resultado_recibos(request_id,tentativa_id,fence,payload,resultado) values(p_request_id,v.id,v.fence,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(null,'integracao.t24_resultado_conservador','sso_t24_tentativas',v.id,jsonb_build_object('requestId',p_request_id,'fence',v.fence,'estado',p_estado,'motivo',p_motivo));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_t24_registrar_resultado_conservador(uuid,uuid,bigint,text,text,text) from public,anon,authenticated,service_role;
