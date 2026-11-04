-- ADR-1015: INSERT com vínculo exige capacidade atual, sem alterar cópias legadas.
create function comercial.sso_guardar_insercao_assessment() returns trigger language plpgsql security definer set search_path='' as $$
declare v_ativo boolean; v_cliente uuid;
begin
  if new.assessment_id is null then return new; end if;
  select g.habilitado into v_ativo from comercial.sso_escrita_assessment_gate g where g.id for share;
  if v_ativo is distinct from true then return new; end if;
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null then raise exception 'proposta_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from comercial.sso_assessment_cliente_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'guarda_assessment_desabilitada' using errcode='55000'; end if;
  select o.cliente_id into v_cliente from comercial.oportunidades o where o.id=new.oportunidade_id and o.deleted_at is null;
  if v_cliente is null or config.sso_autorizar_acao('orcamento.emitir',v_cliente) is distinct from true then raise exception 'proposta_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  return new;
end;
$$;
revoke all on function comercial.sso_guardar_insercao_assessment() from public,anon,authenticated,service_role;
create trigger sso_assessment_insercao_autorizada before insert on comercial.propostas for each row execute function comercial.sso_guardar_insercao_assessment();
