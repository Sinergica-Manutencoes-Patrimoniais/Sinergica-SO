-- ADR-1029: mediador privado, rollout coordenado obrigatório.
create table pcm.sso_geracao_com_supressao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_geracao_com_supressao_gate(id,habilitado) values(true,false);
alter table pcm.sso_geracao_com_supressao_gate enable row level security;
alter table pcm.sso_geracao_com_supressao_gate force row level security;
revoke all on pcm.sso_geracao_com_supressao_gate from public,anon,authenticated,service_role;
create function pcm.sso_pcm_gerar_visita_suprimivel(p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_serie_id uuid,p_regra_id uuid,p_semana date,p_visita_id uuid,p_inicio_em timestamptz,p_responsavel_id uuid,p_cobertura text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode='42501'; end if;
  if p_cliente_id is null or p_request_id is null or p_serie_id is null or p_semana is null or not pg_catalog.isfinite(p_semana) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_geracao_com_supressao_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'geracao_visita_bloqueada' using errcode='55000'; end if;
  perform 1 from pcm.sso_supressao_semana_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'supressao_semana_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_coordenacao_feriados_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'coordenacao_feriados_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-feriados-cliente:'||p_cliente_id::text,0)) then raise exception 'feriados_em_alteracao' using errcode='55P03'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-semana-visita:'||p_serie_id::text||':'||p_semana::text,0)) then raise exception 'semana_em_alteracao' using errcode='55P03'; end if;
  if not exists(select 1 from pcm.sso_geracao_visita_contratual c where c.request_id=p_request_id) and exists(
    select 1 from pcm.sso_supressoes_semana_feriado s where s.cliente_id=p_cliente_id and s.serie_id=p_serie_id and s.semana_origem=p_semana
    and not exists(select 1 from pcm.sso_revogacoes_supressao_semana r where r.supressao_id=s.id)) then raise exception 'semana_suprimida_feriado' using errcode='23514'; end if;
  return pcm.sso_pcm_gerar_visita(p_request_id,p_cliente_id,p_serie_id,p_regra_id,p_semana,p_visita_id,p_inicio_em,p_responsavel_id,p_cobertura);
end;
$$;
revoke all on function pcm.sso_pcm_gerar_visita_suprimivel(uuid,uuid,uuid,uuid,uuid,date,uuid,timestamptz,uuid,text) from public,anon,authenticated,service_role;
revoke all on function pcm.sso_pcm_gerar_visita(uuid,uuid,uuid,uuid,date,uuid,timestamptz,uuid,text) from public,anon,authenticated,service_role;
