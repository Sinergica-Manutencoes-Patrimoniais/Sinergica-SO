-- ADR-1058. Leitura privada, sem mudança de regra, Visita ou ocorrência.
create function pcm.sso_listar_ocorrencias_impacto_dia(p_ator_id uuid,p_cliente_id uuid,p_serie_id uuid,p_visita_id uuid,p_apos uuid,p_limite integer)
returns table(ocorrencia_id uuid,plano_id uuid,rotina_id uuid,vencimento_original date,possui_vinculo_legado boolean)
language plpgsql volatile security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_serie_id is null or p_visita_id is null
    or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_previa_mudanca_dia_gate where id and habilitado for share;
  if not found then raise exception 'previa_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or
    config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not exists(select 1 from pcm.visita_origem_contratual o join pcm.visitas v on v.id=o.visita_id and v.cliente_id=o.cliente_id
    where o.visita_id=p_visita_id and o.serie_id=p_serie_id and o.cliente_id=p_cliente_id) then raise exception 'visita_indisponivel' using errcode='42501'; end if;
  return query select x.id,x.plano_id,x.rotina_id,x.vencimento_original,
    exists(select 1 from pcm.sso_vinculos_visita_legado l where l.ocorrencia_visita_id=x.id and l.cliente_id=p_cliente_id)
    from pcm.ocorrencias_visita_preparadas x join pcm.planos_manutencao p on p.id=x.plano_id and p.cliente_id=p_cliente_id
    where x.visita_id=p_visita_id and x.serie_id=p_serie_id and (p_apos is null or x.id>p_apos) order by x.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_ocorrencias_impacto_dia(uuid,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
