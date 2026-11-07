-- ADR-1170: observação imutável; não atualiza estado ou identidade da OS.
create table pcm.sso_t24_resposta_tardia_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_t24_resposta_tardia_gate(id,habilitado) values(true,false);
create table pcm.sso_t24_respostas_tardias(request_id uuid primary key,tentativa_id uuid not null references pcm.sso_t24_tentativas(id),
 fence bigint not null check(fence>0),tarefa_observada text,motivo text not null,payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now());
alter table pcm.sso_t24_resposta_tardia_gate enable row level security;alter table pcm.sso_t24_resposta_tardia_gate force row level security;
alter table pcm.sso_t24_respostas_tardias enable row level security;alter table pcm.sso_t24_respostas_tardias force row level security;
revoke all on pcm.sso_t24_resposta_tardia_gate,pcm.sso_t24_respostas_tardias from public,anon,authenticated,service_role;
create trigger sso_t24_respostas_tardias_imutaveis before update or delete on pcm.sso_t24_respostas_tardias
 for each row execute function pcm.sso_proteger_nota_reconciliacao();
create function pcm.sso_t24_registrar_resposta_tardia(p_request_id uuid,p_tentativa_id uuid,p_fence bigint,p_tarefa_observada text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare t pcm.sso_t24_tentativas%rowtype;anterior pcm.sso_t24_respostas_tardias%rowtype;payload jsonb;resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.role() is distinct from 'service_role' or p_request_id is null or p_tentativa_id is null or p_fence is null or p_fence not between 1 and 9007199254740991
  or p_motivo is null or p_motivo !~ '^[a-z0-9_]{1,120}$' or (p_tarefa_observada is not null and (p_tarefa_observada<>btrim(p_tarefa_observada) or length(p_tarefa_observada) not between 1 and 200)) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform 1 from pcm.sso_t24_resposta_tardia_gate where id and habilitado for share;
 if not found then raise exception 'registro_desabilitado' using errcode='55000'; end if;
 payload:=jsonb_build_object('tentativaId',p_tentativa_id,'fence',p_fence,'tarefaObservada',p_tarefa_observada,'motivo',p_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-t24-tardia:'||p_request_id::text,0));
 select * into anterior from pcm.sso_t24_respostas_tardias where request_id=p_request_id;
 if found then if anterior.payload is distinct from payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return anterior.resultado;end if;
 select * into t from pcm.sso_t24_tentativas where id=p_tentativa_id for share;
 if not found or t.fence<p_fence or (t.fence=p_fence and t.estado in ('reservado','iniciado')) then raise exception 'resposta_nao_tardia' using errcode='23514'; end if;
 if not exists(select 1 from pcm.sso_t24_tentativa_eventos e where e.tentativa_id=t.id and e.fence=p_fence and e.estado='iniciado') then raise exception 'inicio_nao_comprovado' using errcode='23514'; end if;
 resultado:=jsonb_build_object('requestId',p_request_id,'tentativaId',t.id,'fenceObservado',p_fence,'estadoAtual',t.estado,'efeitoRemotoComprovado',false);
 insert into pcm.sso_t24_respostas_tardias(request_id,tentativa_id,fence,tarefa_observada,motivo,payload,resultado) values(p_request_id,t.id,p_fence,p_tarefa_observada,p_motivo,payload,resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(null,'integracao.t24_resposta_tardia','sso_t24_tentativas',t.id,jsonb_build_object('requestId',p_request_id,'fenceObservado',p_fence,'estadoAtual',t.estado,'motivo',p_motivo));
 return resultado;
end; $$;
revoke all on function pcm.sso_t24_registrar_resposta_tardia(uuid,uuid,bigint,text,text) from public,anon,authenticated,service_role;
