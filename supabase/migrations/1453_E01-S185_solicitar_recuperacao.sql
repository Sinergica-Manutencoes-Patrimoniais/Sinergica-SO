-- ADR-1306: registra intenção local; não executa retry nem altera fila.
create table pcm.sso_solicitacao_recuperacao_gate (
  id boolean primary key default true check(id), habilitado boolean not null default false
);
insert into pcm.sso_solicitacao_recuperacao_gate(id,habilitado) values(true,false);
create table pcm.sso_solicitacoes_recuperacao (
  request_id uuid primary key, ator_id uuid not null references auth.users(id),
  cliente_id uuid not null references pcm.clientes(id), outbox_id uuid not null,
  epoca uuid not null, revisao text not null, motivo text not null,
  payload jsonb not null, resultado jsonb not null, criado_em timestamptz not null default now()
);
alter table pcm.sso_solicitacao_recuperacao_gate enable row level security;
alter table pcm.sso_solicitacao_recuperacao_gate force row level security;
alter table pcm.sso_solicitacoes_recuperacao enable row level security;
alter table pcm.sso_solicitacoes_recuperacao force row level security;
revoke all on pcm.sso_solicitacao_recuperacao_gate,pcm.sso_solicitacoes_recuperacao from public,anon,authenticated,service_role;
create trigger sso_solicitacoes_recuperacao_imutaveis before update or delete on pcm.sso_solicitacoes_recuperacao
  for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_previa_recuperacao_fila(p_ator_id uuid,p_cliente_id uuid,p_outbox_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_ator_id then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_solicitacao_recuperacao_gate where id and habilitado for share;
  if not found then raise exception 'solicitacao_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.reconciliacao_revisao_fila_gate where id and habilitado for share;
  if not found then raise exception 'revisao_desabilitada' using errcode='55000'; end if;
  return pcm.sso_previa_revisao_fila(p_cliente_id,p_outbox_id);
end; $$;
revoke all on function pcm.sso_previa_recuperacao_fila(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_previa_recuperacao_fila(uuid,uuid,uuid) to authenticated;

create function pcm.sso_solicitar_recuperacao_fila(
  p_ator_id uuid,p_cliente_id uuid,p_outbox_id uuid,p_request_id uuid,p_epoca uuid,p_revisao text,p_motivo text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_antes pcm.sso_solicitacoes_recuperacao%rowtype;v_fila pcm.auvo_sync_outbox%rowtype;
  v_previa jsonb;v_payload jsonb;v_resultado jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_outbox_id is null
    or p_request_id is null or p_epoca is null or p_revisao is null or p_revisao !~ '^(0|[1-9][0-9]{0,18})$'
    or v_motivo is null or length(v_motivo)>2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_solicitacao_recuperacao_gate where id and habilitado for share;
  if not found then raise exception 'solicitacao_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.reconciliacao_revisao_fila_gate where id and habilitado and epoca=p_epoca for share;
  if not found then raise exception 'epoca_indisponivel' using errcode='40001'; end if;
  if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('clienteId',p_cliente_id,'outboxId',p_outbox_id,'epoca',p_epoca,'revisao',p_revisao,'motivo',v_motivo);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-solicitacao-recuperacao:'||p_request_id::text,0));
  select * into v_antes from pcm.sso_solicitacoes_recuperacao where request_id=p_request_id;
  if found then
    if v_antes.ator_id is distinct from p_ator_id or v_antes.cliente_id is distinct from p_cliente_id or v_antes.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode='23505'; end if;
    perform pcm.sso_previa_revisao_fila(p_cliente_id,p_outbox_id);
    return v_antes.resultado;
  end if;
  select * into v_fila from pcm.auvo_sync_outbox where id=p_outbox_id for update;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_previa:=pcm.sso_previa_revisao_fila(p_cliente_id,p_outbox_id);
  if v_previa->>'epoca' is distinct from p_epoca::text or v_previa->>'revisao' is distinct from p_revisao then
    raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_resultado:=jsonb_build_object('requestId',p_request_id,'outboxId',p_outbox_id,'epoca',p_epoca,'revisao',p_revisao,
    'solicitacaoRegistrada',true,'efeitoRemotoComprovado',false,'retryExecutado',false);
  insert into pcm.sso_solicitacoes_recuperacao(request_id,ator_id,cliente_id,outbox_id,epoca,revisao,motivo,payload,resultado)
    values(p_request_id,p_ator_id,p_cliente_id,p_outbox_id,p_epoca,p_revisao,v_motivo,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload)
    values(p_ator_id,'integracao.recuperacao_solicitada','auvo_sync_outbox',p_outbox_id,v_resultado);
  return v_resultado;
end; $$;
revoke all on function pcm.sso_solicitar_recuperacao_fila(uuid,uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_solicitar_recuperacao_fila(uuid,uuid,uuid,uuid,uuid,text,text) to authenticated;
