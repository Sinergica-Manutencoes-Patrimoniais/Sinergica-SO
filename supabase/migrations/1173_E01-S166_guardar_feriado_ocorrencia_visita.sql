-- ADR-1022: revalidação ao inserir ocorrência por Visita, sem alterar calendário existente.
create function pcm.sso_guardar_feriado_ocorrencia_visita() returns trigger language plpgsql security definer set search_path='' as $$
declare v_ativo boolean; v_cliente uuid; v_contrato uuid;
begin
  select g.habilitado into v_ativo from pcm.sso_coordenacao_feriados_gate g where g.id for share;
  if v_ativo is distinct from true then return new; end if;
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  select p.cliente_id into v_cliente from pcm.planos_manutencao p where p.id=new.plano_id;
  if v_cliente is null then raise exception 'plano_indisponivel' using errcode='23514'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-feriados-cliente:'||v_cliente::text,0)) then raise exception 'feriados_em_alteracao' using errcode='55P03'; end if;
  select o.contrato_id into v_contrato from pcm.visita_origem_contratual o
    where o.visita_id=new.visita_id and o.cliente_id=v_cliente and o.serie_id=new.serie_id and o.semana_origem=new.semana_origem;
  if v_contrato is null then raise exception 'origem_contratual_nao_comprovada' using errcode='23514'; end if;
  if exists(select 1 from pcm.feriados_declarados f where f.cliente_id=v_cliente and f.ativo and f.data=new.vencimento_original and (f.contrato_id is null or f.contrato_id=v_contrato)) then
    raise exception 'feriado_declarado' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function pcm.sso_guardar_feriado_ocorrencia_visita() from public,anon,authenticated,service_role;
create trigger sso_feriado_ocorrencia_visita_guard before insert on pcm.ocorrencias_visita_preparadas for each row execute function pcm.sso_guardar_feriado_ocorrencia_visita();
