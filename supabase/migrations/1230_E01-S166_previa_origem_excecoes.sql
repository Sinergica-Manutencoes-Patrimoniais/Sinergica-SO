-- ADR-1079: inclui datas de origem e proposta; não altera programação.
create or replace function pcm.sso_prever_mudanca_dia(p_ator_id uuid,p_cliente_id uuid,p_serie_id uuid,p_expected_revision integer,p_vigencia date,p_dia_semana integer,p_apos_semana date,p_apos_id uuid,p_limite integer)
returns table(visita_id uuid,semana_origem date,regra_origem_id uuid,inicio_em timestamptz,estado text,revisao integer,data_proposta date,classificacao text)
language plpgsql volatile security definer set search_path='' as $$
declare v_regra pcm.regras_visita_contratual%rowtype;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_serie_id is null or p_expected_revision is null or p_expected_revision<1
    or p_vigencia is null or not isfinite(p_vigencia) or p_dia_semana is null or p_dia_semana not between 1 and 7 or p_limite is null or p_limite not between 1 and 100
    or ((p_apos_semana is null)<>(p_apos_id is null)) or (p_apos_semana is not null and not isfinite(p_apos_semana)) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_previa_mudanca_dia_gate where id and habilitado for share;if not found then raise exception 'previa_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not exists(select 1 from pcm.calendario_contratual_series s where s.id=p_serie_id and s.cliente_id=p_cliente_id) then raise exception 'serie_indisponivel' using errcode='42501'; end if;
  select * into v_regra from pcm.regras_visita_contratual where serie_id=p_serie_id order by numero desc limit 1;
  if not found or v_regra.numero is distinct from p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  return query select v.id,o.semana_origem,o.regra_id,v.inicio_em,v.estado,v.revisao,o.semana_origem+(p_dia_semana-1),
    case when o.semana_origem+(p_dia_semana-1)<p_vigencia then 'data_proposta_antes_vigencia'
      when v.estado in ('rascunho','planejada') and v.inicio_em>now()
        and v.fuso=origem.fuso and (v.inicio_em at time zone origem.fuso)::date=o.semana_origem+(origem.dia_semana-1)
        and (v.inicio_em at time zone origem.fuso)::time=origem.hora_inicio
        and not exists(select 1 from pcm.visita_ordens_servico vo join pcm.ordens_servico os on os.id=vo.os_id and os.client_id=vo.cliente_id
          where vo.visita_id=v.id and vo.cliente_id=p_cliente_id and vo.encerrado_em is null and (os.auvo_task_id is not null or os.auvo_sync_status is not null))
        then 'candidata_revisao' else 'preservar_e_conferir' end::text
    from pcm.visita_origem_contratual o join pcm.visitas v on v.id=o.visita_id and v.cliente_id=p_cliente_id
    join pcm.regras_visita_contratual origem on origem.id=o.regra_id and origem.serie_id=o.serie_id
    where o.serie_id=p_serie_id and o.cliente_id=p_cliente_id
      and greatest((v.inicio_em at time zone origem.fuso)::date,o.semana_origem+(origem.dia_semana-1),o.semana_origem+(p_dia_semana-1))>=p_vigencia
      and (p_apos_semana is null or (o.semana_origem,o.visita_id)>(p_apos_semana,p_apos_id))
    order by o.semana_origem,o.visita_id limit p_limite;
end; $$;
