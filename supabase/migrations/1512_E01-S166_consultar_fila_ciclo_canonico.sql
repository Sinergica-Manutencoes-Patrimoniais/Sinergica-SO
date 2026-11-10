-- ADR-1365: leitura por identidade de ciclo, inclusive versão de origem diferente.
create or replace function pcm.sso_consultar_entrada_fila_preventiva(p_cliente_id uuid,p_plano_id uuid,p_preparada_id uuid)
returns table(ciclo_id uuid,preparada_id uuid,estado text,revisao integer,vencimento date,atualizado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
declare v_ciclo uuid;
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_fila_preventiva_pcm_gate where id and habilitado for share;
  if not found then raise exception 'fila_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_plano_id is null or p_preparada_id is null
    or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true
    or not exists(select 1 from pcm.ocorrencias_rotina_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id
      where o.id=p_preparada_id and o.plano_id=p_plano_id and p.cliente_id=p_cliente_id)
  then raise exception 'sem_acesso' using errcode='42501'; end if;
  select cv.ciclo_id into v_ciclo from pcm.sso_ciclo_calendario_versoes cv
    join pcm.ocorrencias_rotina_preparadas o on o.id=cv.preparada_id and o.versao_id=cv.versao_id
    join pcm.sso_ciclos_calendario_canonicos c on c.id=cv.ciclo_id
    join pcm.sso_series_ciclo_calendario s on s.id=c.serie_id and s.plano_id=o.plano_id
      and s.rotina_logica_id=o.rotina_logica_id and s.alvo_tipo=o.alvo_tipo and s.alvo_id=o.alvo_id
    where o.id=p_preparada_id and o.plano_id=p_plano_id and c.indice=o.ciclo and c.vencimento_original=o.vencimento_original;
  if v_ciclo is null then raise exception 'identidade_indisponivel' using errcode='23514'; end if;
  if exists(select 1 from pcm.sso_fila_preventiva_pcm f where f.ciclo_id=v_ciclo and
    (f.cliente_id is distinct from p_cliente_id or f.plano_id is distinct from p_plano_id
      or not exists(select 1 from pcm.sso_ciclo_calendario_versoes origem
        join pcm.ocorrencias_rotina_preparadas o on o.id=origem.preparada_id and o.versao_id=origem.versao_id
        where origem.preparada_id=f.preparada_id and origem.ciclo_id=v_ciclo and o.plano_id=p_plano_id)))
  then raise exception 'fila_inconsistente' using errcode='23514'; end if;
  return query select f.ciclo_id,f.preparada_id,f.estado,f.revisao,c.vencimento_original,f.atualizado_em
    from pcm.sso_fila_preventiva_pcm f join pcm.sso_ciclos_calendario_canonicos c on c.id=f.ciclo_id
    where f.cliente_id=p_cliente_id and f.plano_id=p_plano_id and f.ciclo_id=v_ciclo;
end; $$;
