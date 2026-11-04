-- ADR-1013: comando privado com retorno mínimo.
create table comercial.sso_vinculo_assessment_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into comercial.sso_vinculo_assessment_gate(id,habilitado) values(true,false);
alter table comercial.sso_vinculo_assessment_gate enable row level security;
alter table comercial.sso_vinculo_assessment_gate force row level security;
revoke all on comercial.sso_vinculo_assessment_gate from public,anon,authenticated,service_role;
create function comercial.sso_vincular_assessment(p_ator_id uuid,p_cliente_id uuid,p_proposta_id uuid,p_inspecao_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_p comercial.propostas%rowtype; v_cliente uuid; v_cliente_inspecao uuid;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode='42501'; end if;
  if p_cliente_id is null or p_proposta_id is null or p_inspecao_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from comercial.sso_vinculo_assessment_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'vinculo_assessment_desabilitado' using errcode='55000'; end if;
  perform 1 from comercial.sso_assessment_cliente_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'guarda_assessment_desabilitada' using errcode='55000'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-assessment-proposta-cliente',0)) then raise exception 'assessment_em_alteracao' using errcode='55P03'; end if;
  select * into v_p from comercial.propostas where id=p_proposta_id and deleted_at is null for update;
  if not found then raise exception 'proposta_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  select o.cliente_id into v_cliente from comercial.oportunidades o where o.id=v_p.oportunidade_id and o.deleted_at is null for share;
  if v_cliente is distinct from p_cliente_id or config.sso_autorizar_acao('orcamento.emitir',v_cliente) is distinct from true then raise exception 'proposta_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  if v_p.assessment_id=p_inspecao_id then return pg_catalog.jsonb_build_object('clienteId',v_cliente,'propostaId',p_proposta_id,'assessmentId',p_inspecao_id); end if;
  if v_p.assessment_id is not null then raise exception 'assessment_ja_vinculado' using errcode='23514'; end if;
  if v_p.status not in ('rascunho','em_revisao','aprovada') then raise exception 'proposta_nao_editavel' using errcode='23514'; end if;
  select i.client_id into v_cliente_inspecao from pcm.inspecoes i where i.id=p_inspecao_id and i.deleted_at is null for share;
  if v_cliente_inspecao is distinct from v_cliente then raise exception 'assessment_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  insert into comercial.sso_escrita_assessment_permissoes(transacao,proposta_id,assessment_anterior,assessment_novo)
    values(pg_catalog.txid_current(),p_proposta_id,v_p.assessment_id,p_inspecao_id);
  update comercial.propostas set assessment_id=p_inspecao_id,updated_at=pg_catalog.now() where id=p_proposta_id;
  delete from comercial.sso_escrita_assessment_permissoes where transacao=pg_catalog.txid_current() and proposta_id=p_proposta_id;
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'proposta.assessment_vinculado','proposta',p_proposta_id,pg_catalog.jsonb_build_object('clienteId',v_cliente,'assessmentId',p_inspecao_id));
  return pg_catalog.jsonb_build_object('clienteId',v_cliente,'propostaId',p_proposta_id,'assessmentId',p_inspecao_id);
end;
$$;
revoke all on function comercial.sso_vincular_assessment(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
