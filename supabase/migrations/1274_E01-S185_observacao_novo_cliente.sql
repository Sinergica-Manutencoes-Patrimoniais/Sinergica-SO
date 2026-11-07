-- ADR-1119: reatribui somente a observação corrente, mantendo eventos anteriores.
create table pcm.sso_observacao_novo_cliente_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_observacao_novo_cliente_gate(id,habilitado) values(true,false);
create table pcm.sso_decisoes_observacao_novo_cliente(
 request_id uuid primary key,os_id uuid not null references pcm.ordens_servico(id),cliente_anterior_id uuid not null references pcm.clientes(id),
 cliente_atual_id uuid not null references pcm.clientes(id),conflito_revisao integer not null check(conflito_revisao>0),
 observacao_revisao integer not null check(observacao_revisao>0),ator_id uuid not null references auth.users(id),
 motivo text not null check(length(btrim(motivo)) between 1 and 1000),payload jsonb not null,resultado jsonb not null,
 criado_em timestamptz not null default now(),unique(os_id,conflito_revisao),check(cliente_anterior_id<>cliente_atual_id)
);
alter table pcm.sso_observacao_novo_cliente_gate enable row level security;
alter table pcm.sso_observacao_novo_cliente_gate force row level security;
alter table pcm.sso_decisoes_observacao_novo_cliente enable row level security;
alter table pcm.sso_decisoes_observacao_novo_cliente force row level security;
revoke all on pcm.sso_observacao_novo_cliente_gate,pcm.sso_decisoes_observacao_novo_cliente from public,anon,authenticated,service_role;
create trigger sso_decisoes_observacao_novo_cliente_imutaveis before update or delete on pcm.sso_decisoes_observacao_novo_cliente
 for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function pcm.sso_iniciar_observacao_novo_cliente(p_request_id uuid,p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,
 p_conflito_revisao integer,p_observacao_revisao integer,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant pcm.sso_decisoes_observacao_novo_cliente%rowtype;v_conflito pcm.sso_conflitos_propriedade_os%rowtype;
 v_obs pcm.sso_observacoes_os%rowtype;v_os pcm.ordens_servico%rowtype;v_estado text;v_sync text;v_possui boolean;
 v_fonte timestamptz;v_payload jsonb;v_resultado jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_request_id is null or p_cliente_id is null or p_os_id is null
  or p_conflito_revisao is null or p_conflito_revisao<1 or p_observacao_revisao is null or p_observacao_revisao<1
  or v_motivo is null or length(v_motivo)>1000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_observacao_novo_cliente_gate where id and habilitado for share;
 if not found then raise exception 'observacao_novo_cliente_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_observacao_os_gate where id and habilitado for share;
 if not found then raise exception 'observacao_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.reconciliacao_outbox_gate where id and habilitado for share;
 if not found then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'osId',p_os_id,'conflitoRevision',p_conflito_revisao,'observacaoRevision',p_observacao_revisao,'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-observacao-novo-cliente:'||p_request_id::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reconciliacao-observacao-os-item:'||p_os_id::text,0));
 select * into v_os from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null for share;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_decisoes_observacao_novo_cliente where request_id=p_request_id;
 if found then
  if v_ant.ator_id is distinct from p_ator_id or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  if config.sso_autorizar_acao('integracao.reconciliar',v_ant.cliente_anterior_id) is distinct from true or
   config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return v_ant.resultado;
 end if;
 select * into v_obs from pcm.sso_observacoes_os where os_id=p_os_id for update;
 if not found or v_obs.revisao is distinct from p_observacao_revisao or v_obs.cliente_id=p_cliente_id then raise exception 'conflito_ou_propriedade_alterada' using errcode='40001'; end if;
 if config.sso_autorizar_acao('integracao.reconciliar',v_obs.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_conflito from pcm.sso_conflitos_propriedade_os where os_id=p_os_id for update;
 if not found or v_conflito.revisao is distinct from p_conflito_revisao or v_conflito.cliente_observacao_id is distinct from v_obs.cliente_id
  or v_conflito.cliente_atual_id is distinct from p_cliente_id then raise exception 'conflito_ou_propriedade_alterada' using errcode='40001'; end if;
 v_fonte:=coalesce(v_os.updated_at,v_os.created_at);v_sync:=v_os.auvo_sync_status::text;v_possui:=v_os.auvo_task_id is not null;
 if v_fonte is null or not isfinite(v_fonte) then raise exception 'origem_invalida' using errcode='23514'; end if;
 v_estado:=case when v_possui then 'vinculo_observado_nao_confirmado' else 'incerto' end;
 if config.sso_autorizar_acao('integracao.reconciliar',v_obs.cliente_id) is distinct from true or
  config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 update pcm.sso_observacoes_os set cliente_id=p_cliente_id,estado_local=v_estado,sincronizacao=v_sync,possui_tarefa=v_possui,
  fonte_atualizada_em=v_fonte,revisao=revisao+1,atualizado_em=now() where os_id=p_os_id;
 insert into pcm.sso_observacoes_os_eventos(os_id,revisao,request_id,ator_id,origem,estado_local,sincronizacao,possui_tarefa,fonte_atualizada_em)
  values(p_os_id,v_obs.revisao+1,p_request_id,p_ator_id,'operador',v_estado,v_sync,v_possui,v_fonte);
 v_resultado:=jsonb_build_object('requestId',p_request_id,'osId',p_os_id,'clienteId',p_cliente_id,'conflitoRevision',p_conflito_revisao,
  'observacaoRevision',v_obs.revisao+1,'estado',v_estado,'historicoTransferido',false,'efeitoRemotoComprovado',false);
 insert into pcm.sso_decisoes_observacao_novo_cliente(request_id,os_id,cliente_anterior_id,cliente_atual_id,conflito_revisao,observacao_revisao,ator_id,motivo,payload,resultado)
  values(p_request_id,p_os_id,v_obs.cliente_id,p_cliente_id,p_conflito_revisao,p_observacao_revisao,p_ator_id,v_motivo,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'integracao.observacao_os_novo_cliente','ordens_servico',p_os_id,v_resultado||jsonb_build_object('motivo',v_motivo));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_iniciar_observacao_novo_cliente(uuid,uuid,uuid,uuid,integer,integer,text) from public,anon,authenticated,service_role;
