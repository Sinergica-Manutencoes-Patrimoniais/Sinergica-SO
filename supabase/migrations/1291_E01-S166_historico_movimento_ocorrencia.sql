-- ADR-1128: consulta de histórico, sem alteração de vencimento ou programação.
create function pcm.sso_listar_movimentos_ocorrencia_dia(p_ator_id uuid,p_cliente_id uuid,p_visita_id uuid,p_ocorrencia_id uuid,p_apos integer,p_limite integer)
returns table(revisao_visita integer,vencimento_original date,inicio_anterior timestamptz,inicio_novo timestamptz,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_visita_id is null or p_ocorrencia_id is null
  or p_apos is null or p_apos<0 or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_mudanca_dia_ocorrencia_gate where id and habilitado for share;
 if not found then raise exception 'historico_indisponivel' using errcode='55000'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.ocorrencias_visita_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente_id
  join pcm.visitas v on v.id=o.visita_id and v.cliente_id=p_cliente_id where o.id=p_ocorrencia_id and v.id=p_visita_id for share of o,p,v;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select m.revisao_visita,m.vencimento_original,m.inicio_anterior,m.inicio_novo,m.criado_em
  from pcm.sso_movimentos_ocorrencias_dia m where m.cliente_id=p_cliente_id and m.visita_id=p_visita_id and m.ocorrencia_id=p_ocorrencia_id
   and m.revisao_visita>p_apos order by m.revisao_visita limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_movimentos_ocorrencia_dia(uuid,uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_movimentos_ocorrencia_dia(uuid,uuid,uuid,uuid,integer,integer) to authenticated;
