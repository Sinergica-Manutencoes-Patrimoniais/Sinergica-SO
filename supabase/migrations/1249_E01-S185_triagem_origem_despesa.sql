-- ADR-1100: somente diagnóstico local, sem correção ou valores.
create function pcm.sso_listar_origens_despesa_incompletas(p_ator_id uuid,p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(item_id uuid,estado_fonte text,classificacao text,revisao integer,observado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_varredura_origens_gate where id and habilitado for share;
 if not found then raise exception 'observacao_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.reconciliacao_outbox_gate where id and habilitado for share;
 if not found then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select o.objeto_id,o.estado_fonte,o.classificacao,o.revisao,o.atualizado_em
  from pcm.sso_observacoes_origens_internas o join financeiro.itens_faturaveis f on f.id=o.objeto_id and f.cliente_id=o.cliente_id
  where o.tipo='financeiro' and o.cliente_id=p_cliente_id and o.classificacao in ('declaracao_ausente_conferir','despesa_indisponivel_conferir')
   and (p_apos is null or o.objeto_id>p_apos)
  order by o.objeto_id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_origens_despesa_incompletas(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
