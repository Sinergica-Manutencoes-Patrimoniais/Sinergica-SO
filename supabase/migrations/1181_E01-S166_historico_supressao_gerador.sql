-- ADR-1030: coincidência histórica, sem inferir qual feriado causou a decisão.
create table pcm.sso_historico_supressao_gerador_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_historico_supressao_gerador_gate(id,habilitado) values(true,false);
alter table pcm.sso_historico_supressao_gerador_gate enable row level security;
alter table pcm.sso_historico_supressao_gerador_gate force row level security;
revoke all on pcm.sso_historico_supressao_gerador_gate from public,anon,authenticated,service_role;
create function pcm.sso_listar_supressoes_gerador_feriado(p_ator_id uuid,p_cliente_id uuid,p_feriado_id uuid,p_apos uuid,p_limite integer)
returns table(request_id uuid,serie_id uuid,regra_id uuid,semana date,data_contratual date,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
declare v_f pcm.feriados_declarados%rowtype;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode='42501'; end if;
  if p_cliente_id is null or p_feriado_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_historico_supressao_gerador_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'historico_supressao_desabilitado' using errcode='55000'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_f from pcm.feriados_declarados where id=p_feriado_id and cliente_id=p_cliente_id;
  if not found then raise exception 'feriado_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  return query select g.request_id,g.serie_id,g.regra_id,g.semana,(g.semana+(r.dia_semana-1))::date,g.criado_em
    from pcm.sso_geracao_visita_contratual g join pcm.calendario_contratual_series s on s.id=g.serie_id and s.cliente_id=g.cliente_id
    join pcm.regras_visita_contratual r on r.id=g.regra_id and r.serie_id=g.serie_id
    where g.cliente_id=p_cliente_id and g.decisao='suprimida_feriado' and (g.semana+(r.dia_semana-1))::date=v_f.data
      and (v_f.contrato_id is null or s.contrato_id=v_f.contrato_id) and (p_apos is null or g.request_id>p_apos)
    order by g.request_id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_supressoes_gerador_feriado(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
