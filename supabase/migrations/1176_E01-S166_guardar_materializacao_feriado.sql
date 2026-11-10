-- ADR-1025: guarda transacional, não impede vínculo histórico isolado.
create function pcm.sso_guardar_feriado_materializacao_visita() returns trigger language plpgsql security definer set search_path='' as $$
declare v_ativo boolean; v_prep pcm.ocorrencias_visita_preparadas%rowtype; v_contrato uuid;
begin
  select g.habilitado into v_ativo from pcm.sso_coordenacao_feriados_gate g where g.id for share;
  if v_ativo is distinct from true then return new; end if;
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-feriados-cliente:'||new.cliente_id::text,0)) then raise exception 'feriados_em_alteracao' using errcode='55P03'; end if;
  select o.* into v_prep from pcm.ocorrencias_visita_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=new.cliente_id where o.id=new.preparada_id;
  if not found then raise exception 'preparada_indisponivel' using errcode='23514'; end if;
  select v.contrato_id into v_contrato from pcm.visita_origem_contratual v where v.visita_id=v_prep.visita_id and v.cliente_id=new.cliente_id and v.serie_id=v_prep.serie_id and v.semana_origem=v_prep.semana_origem;
  if v_contrato is null then raise exception 'origem_visita_nao_comprovada' using errcode='23514'; end if;
  if exists(select 1 from pcm.feriados_declarados f where f.cliente_id=new.cliente_id and f.ativo and f.data=v_prep.vencimento_original and (f.contrato_id is null or f.contrato_id=v_contrato)) then raise exception 'feriado_declarado_exige_reconciliacao' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function pcm.sso_guardar_feriado_materializacao_visita() from public,anon,authenticated,service_role;
create trigger sso_feriado_materializacao_visita_guard before insert on pcm.sso_materializacoes_visita_legado for each row execute function pcm.sso_guardar_feriado_materializacao_visita();
