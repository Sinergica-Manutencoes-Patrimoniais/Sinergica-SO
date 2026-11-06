-- ADR-1048: consulta conjunta privada, sem alteração de dados.
create table pcm.sso_conferencia_tolerancias_lote_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_conferencia_tolerancias_lote_gate(id,habilitado) values(true,false);
alter table pcm.sso_conferencia_tolerancias_lote_gate enable row level security;
alter table pcm.sso_conferencia_tolerancias_lote_gate force row level security;
revoke all on pcm.sso_conferencia_tolerancias_lote_gate from public,anon,authenticated,service_role;
create function pcm.sso_conferir_tolerancias_lote(p_ator_id uuid,p_cliente_id uuid,p_lote_id uuid,p_expected_revision integer,p_mapeamentos uuid[])
returns table(mapeamento_id uuid,antes integer,depois integer,configurada boolean,revision integer)
language plpgsql volatile security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_total integer;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1
    or p_mapeamentos is null or cardinality(p_mapeamentos) not between 1 and 25 or array_position(p_mapeamentos,null) is not null
    or (select count(distinct x) from unnest(p_mapeamentos) x)<>cardinality(p_mapeamentos) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_conferencia_tolerancias_lote_gate where id and habilitado for share;if not found then raise exception 'conferencia_desabilitada' using errcode='55000'; end if;
  perform pcm.sso_exigir_mediacao_cronograma(p_cliente_id);
  perform 1 from pcm.sso_cronograma_staging_gate where id and habilitado for share;if not found then raise exception 'cronograma_staging_bloqueado' using errcode='55000'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
  select * into v_lote from pcm.sso_levantamentos where id=p_lote_id and cliente_id=p_cliente_id and origem='planilha' and chave_origem like 'cronograma:%' for share;
  if not found then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
  if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  select count(*) into v_total from pcm.sso_cronograma_mapeamentos m where m.lote_id=p_lote_id and m.id=any(p_mapeamentos)
    and not exists(select 1 from pcm.sso_cronograma_mapeamentos n where n.lote_id=m.lote_id and n.chave_linha=m.chave_linha and n.revisao_lote>m.revisao_lote);
  if v_total<>cardinality(p_mapeamentos) then raise exception 'mapeamento_indisponivel' using errcode='23514'; end if;
  return query select m.id,coalesce(t.antes,0),coalesce(t.depois,0),t.id is not null,v_lote.revisao
    from pcm.sso_cronograma_mapeamentos m
    left join lateral (select x.id,x.antes,x.depois from pcm.sso_cronograma_tolerancias_mapeamento x where x.lote_id=p_lote_id and x.mapeamento_id=m.id order by x.revisao_lote desc limit 1) t on true
    where m.lote_id=p_lote_id and m.id=any(p_mapeamentos) order by m.id;
end; $$;
revoke all on function pcm.sso_conferir_tolerancias_lote(uuid,uuid,uuid,integer,uuid[]) from public,anon,authenticated,service_role;
