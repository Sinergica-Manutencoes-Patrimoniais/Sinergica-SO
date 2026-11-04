-- ADR-1133: somente registra conferência; não altera fila ou histórico.
create table pcm.sso_confirmacao_retorno_fila_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_confirmacao_retorno_fila_gate(id,habilitado) values(true,false);
create table pcm.sso_confirmacoes_retorno_propriedade_fila(
 request_id uuid primary key,outbox_id uuid not null references pcm.sso_conflitos_propriedade_fila(outbox_id),
 cliente_id uuid not null references pcm.clientes(id),conflito_revisao integer not null check(conflito_revisao>0),
 ator_id uuid not null references auth.users(id),motivo text not null check(length(btrim(motivo)) between 1 and 1000),
 payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now(),
 unique(outbox_id,conflito_revisao,cliente_id)
);
alter table pcm.sso_confirmacao_retorno_fila_gate enable row level security;
alter table pcm.sso_confirmacao_retorno_fila_gate force row level security;
alter table pcm.sso_confirmacoes_retorno_propriedade_fila enable row level security;
alter table pcm.sso_confirmacoes_retorno_propriedade_fila force row level security;
revoke all on pcm.sso_confirmacao_retorno_fila_gate,pcm.sso_confirmacoes_retorno_propriedade_fila from public,anon,authenticated,service_role;
create trigger sso_confirmacoes_retorno_fila_imutaveis before update or delete on pcm.sso_confirmacoes_retorno_propriedade_fila
 for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function pcm.sso_confirmar_retorno_propriedade_fila(p_request_id uuid,p_ator_id uuid,p_cliente_id uuid,p_outbox_id uuid,p_revisao integer,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant pcm.sso_confirmacoes_retorno_propriedade_fila%rowtype;v_conflito pcm.sso_conflitos_propriedade_fila%rowtype;
 v_fila pcm.auvo_sync_outbox%rowtype;v_cliente uuid;v_ocorrencia uuid;v_demora uuid;
 v_payload jsonb;v_resultado jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_request_id is null or p_cliente_id is null or p_outbox_id is null
  or p_revisao is null or p_revisao<1 or v_motivo is null or length(v_motivo)>1000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_confirmacao_retorno_fila_gate where id and habilitado for share;
 if not found then raise exception 'confirmacao_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_quarentena_fila_gate where id and habilitado for share;
 if not found then raise exception 'quarentena_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.reconciliacao_outbox_gate where id and habilitado for share;
 if not found then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'outboxId',p_outbox_id,'revisao',p_revisao,'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-confirmar-retorno-fila:'||p_request_id::text,0));
 select * into v_fila from pcm.auvo_sync_outbox where id=p_outbox_id for update;
 if not found or v_fila.entity not in ('sistemas','equipamentos') then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 if v_fila.entity='sistemas' then
  select cliente_id into v_cliente from pcm.sistemas where id=v_fila.row_id for share;
 else
  select client_id into v_cliente from pcm.equipamentos where id=v_fila.row_id for share;
 end if;
 if v_cliente is distinct from p_cliente_id then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 select cliente_id into v_ocorrencia from pcm.sso_ocorrencias_fila where outbox_id=p_outbox_id for update;
 select cliente_id into v_demora from pcm.sso_demora_fila_observacoes where outbox_id=p_outbox_id for update;
 select * into v_conflito from pcm.sso_conflitos_propriedade_fila where outbox_id=p_outbox_id for update;
 if not found or v_conflito.entidade is distinct from v_fila.entity or v_conflito.objeto_id is distinct from v_fila.row_id
  or v_conflito.cliente_historico_id is distinct from p_cliente_id
  or (v_ocorrencia is null and v_demora is null) or (v_ocorrencia is not null and v_ocorrencia is distinct from p_cliente_id)
  or (v_demora is not null and v_demora is distinct from p_cliente_id)
  or (v_conflito.fonte='ocorrencia' and v_ocorrencia is distinct from p_cliente_id)
  or (v_conflito.fonte='demora' and v_demora is distinct from p_cliente_id) then raise exception 'conflito_ou_propriedade_alterada' using errcode='40001'; end if;
 select * into v_ant from pcm.sso_confirmacoes_retorno_propriedade_fila where request_id=p_request_id;
 if found then
  if v_ant.ator_id is distinct from p_ator_id or v_ant.cliente_id is distinct from p_cliente_id or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return v_ant.resultado;
 end if;
 if v_conflito.revisao is distinct from p_revisao then raise exception 'conflito_ou_propriedade_alterada' using errcode='40001'; end if;
 if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'outboxId',p_outbox_id,'clienteId',p_cliente_id,'revisao',p_revisao,'historicoTransferido',false,'efeitoRemotoComprovado',false);
 insert into pcm.sso_confirmacoes_retorno_propriedade_fila(request_id,outbox_id,cliente_id,conflito_revisao,ator_id,motivo,payload,resultado)
  values(p_request_id,p_outbox_id,p_cliente_id,p_revisao,p_ator_id,v_motivo,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'integracao.retorno_propriedade_fila_confirmado','auvo_sync_outbox',p_outbox_id,v_resultado||jsonb_build_object('motivo',v_motivo));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_confirmar_retorno_propriedade_fila(uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_confirmar_retorno_propriedade_fila(uuid,uuid,uuid,uuid,integer,text) to authenticated;
