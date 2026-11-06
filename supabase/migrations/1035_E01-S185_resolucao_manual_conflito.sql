-- ADR-0847: resolução explicitamente atestada, gate fechado; sem chamada ao Auvo.
create table pcm.sso_resolucao_conflito_webhook_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_resolucao_conflito_webhook_gate enable row level security;
alter table pcm.sso_resolucao_conflito_webhook_gate force row level security;
revoke all on pcm.sso_resolucao_conflito_webhook_gate from public,anon,authenticated,service_role;
insert into pcm.sso_resolucao_conflito_webhook_gate(id,habilitado) values(true,false);

create table pcm.reconciliacao_webhook_chamado_decisoes (
 request_id uuid primary key, conflito_id uuid not null references pcm.reconciliacao_webhook_chamado_conflitos(id),
 cliente_id uuid not null references pcm.clientes(id), ator_id uuid not null references auth.users(id),
 payload jsonb not null, resultado jsonb not null, criado_em timestamptz not null default now()
);
alter table pcm.reconciliacao_webhook_chamado_decisoes enable row level security;
alter table pcm.reconciliacao_webhook_chamado_decisoes force row level security;
revoke all on pcm.reconciliacao_webhook_chamado_decisoes from public,anon,authenticated,service_role;
create trigger sso_resolucao_conflito_webhook_imutavel before update or delete on pcm.reconciliacao_webhook_chamado_decisoes for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function pcm.sso_resolver_conflito_webhook_chamado(
 p_request_id uuid,p_cliente_id uuid,p_conflito_id uuid,p_os_updated_at timestamptz,
 p_task_id bigint,p_status_atual text,p_conferiu_remoto boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_conflito pcm.reconciliacao_webhook_chamado_conflitos%rowtype;
 v_os pcm.ordens_servico%rowtype; v_ant pcm.reconciliacao_webhook_chamado_decisoes%rowtype;
 v_payload jsonb; v_resultado jsonb; v_resolvido timestamptz;
begin
 if not coalesce((select habilitado from pcm.sso_resolucao_conflito_webhook_gate where id),false) then raise exception 'resolucao_conflito_bloqueada' using errcode='55000'; end if;
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_resolucao_conflito_webhook_gate where id for share;
 if not coalesce((select habilitado from pcm.sso_resolucao_conflito_webhook_gate where id),false) then raise exception 'resolucao_conflito_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_conflito_id is null or p_os_updated_at is null or not isfinite(p_os_updated_at)
   or p_task_id is null or p_task_id<1 or p_status_atual is null or p_conferiu_remoto is distinct from true then raise exception 'resolucao_invalida' using errcode='22023'; end if;
 if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'conflito_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'conflitoId',p_conflito_id,'osUpdatedAt',p_os_updated_at,'taskId',p_task_id,'statusAtual',p_status_atual,'conferenciaRemotaAtestada',true);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('resolucao-conflito-webhook:'||p_request_id::text,0));
 select * into v_ant from pcm.reconciliacao_webhook_chamado_decisoes where request_id=p_request_id;
 if found then
   if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
   return v_ant.resultado;
 end if;
 select * into v_conflito from pcm.reconciliacao_webhook_chamado_conflitos where id=p_conflito_id and cliente_id=p_cliente_id for update;
 if not found then raise exception 'conflito_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
 if v_conflito.resolvido_em is not null then raise exception 'conflito_ja_resolvido' using errcode='23514'; end if;
 select * into v_os from pcm.ordens_servico where id=v_conflito.os_id and client_id=p_cliente_id and deleted_at is null for share;
 if not found then raise exception 'conflito_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
 if coalesce(v_os.updated_at,v_os.created_at) is distinct from p_os_updated_at or v_os.auvo_task_id is distinct from p_task_id
   or v_conflito.auvo_task_id is distinct from p_task_id or v_os.status is distinct from p_status_atual then raise exception 'origem_alterada' using errcode='40001'; end if;
 if v_os.status is distinct from v_conflito.status_remoto then raise exception 'status_ainda_divergente' using errcode='23514'; end if;
 v_resolvido:=clock_timestamp();
 update pcm.reconciliacao_webhook_chamado_conflitos set resolvido_em=v_resolvido where id=v_conflito.id;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'conflitoId',p_conflito_id,'osId',v_os.id,'resolvidoEm',v_resolvido,'conferenciaRemotaAtestada',true);
 insert into pcm.reconciliacao_webhook_chamado_decisoes(request_id,conflito_id,cliente_id,ator_id,payload,resultado) values(p_request_id,p_conflito_id,p_cliente_id,v_actor,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'integracao.resolucao_conflito_webhook','ordens_servico',v_os.id,v_resultado);
 return v_resultado;
end; $$;
revoke all on function pcm.sso_resolver_conflito_webhook_chamado(uuid,uuid,uuid,timestamptz,bigint,text,boolean) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_resolver_conflito_webhook_chamado(uuid,uuid,uuid,timestamptz,bigint,text,boolean) to authenticated;
