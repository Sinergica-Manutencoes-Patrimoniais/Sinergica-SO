-- ADR-1028: histórico privado, inclusive declaração retirada.
create function pcm.sso_listar_supressoes_feriado(p_ator_id uuid,p_cliente_id uuid,p_feriado_id uuid,p_apos uuid,p_limite integer)
returns table(supressao_id uuid,serie_id uuid,regra_id uuid,semana_origem date,data_contratual date,feriado_ativo boolean,revogada boolean,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode='42501'; end if;
  if p_cliente_id is null or p_feriado_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_supressao_semana_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'supressao_semana_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not exists(select 1 from pcm.feriados_declarados f where f.id=p_feriado_id and f.cliente_id=p_cliente_id) then raise exception 'feriado_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  return query select s.id,s.serie_id,s.regra_id,s.semana_origem,s.data_contratual,f.ativo,(r.supressao_id is not null),s.criado_em
    from pcm.sso_supressoes_semana_feriado s join pcm.feriados_declarados f on f.id=s.feriado_id and f.cliente_id=s.cliente_id
    left join pcm.sso_revogacoes_supressao_semana r on r.supressao_id=s.id
    where s.cliente_id=p_cliente_id and s.feriado_id=p_feriado_id and (p_apos is null or s.id>p_apos) order by s.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_supressoes_feriado(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
