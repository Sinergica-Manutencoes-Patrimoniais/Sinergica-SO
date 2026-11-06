-- ADR-1313: leitura de recibo, sem declaração ou efeito financeiro.
create function comercial.sso_recibo_correlacao_gasto(
 p_ator_id uuid,p_cliente_id uuid,p_lista_id uuid,p_request_id uuid,p_fonte_id uuid,p_despesa_id uuid,
 p_vinculo_id uuid,p_despesa_revision integer,p_rateio_revision integer,p_motivo text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant comercial.sso_correlacoes_gasto%rowtype;v_payload jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_lista_id is null
   or p_request_id is null or p_fonte_id is null or p_despesa_id is null or p_vinculo_id is null
   or p_despesa_revision is null or p_despesa_revision<1 or p_rateio_revision is null or p_rateio_revision<1
   or v_motivo is null or length(v_motivo)>1000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
   raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from comercial.sso_correlacao_gasto_gate where id and habilitado for share;
 if not found then raise exception 'correlacao_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('custo.ler',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'fonteId',p_fonte_id,'despesaId',p_despesa_id,'vinculoId',p_vinculo_id,
   'despesaRevision',p_despesa_revision,'rateioRevision',p_rateio_revision,'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('correlacao-gasto:'||p_request_id::text,0));
 select * into v_ant from comercial.sso_correlacoes_gasto where request_id=p_request_id;
 if not found then return null; end if;
 if v_ant.ator_id is distinct from p_ator_id or v_ant.cliente_id is distinct from p_cliente_id or v_ant.payload is distinct from v_payload then
   raise exception 'sem_acesso_ou_tentativa_divergente' using errcode='42501'; end if;
 perform 1 from comercial.sso_fontes_custo_aquisicao f
   join pcm.listas_materiais l on l.id=f.lista_id and l.cliente_id=f.cliente_id
   join pcm.ordens_servico o on o.id=l.ordem_servico_id and o.id=f.os_id and o.client_id=l.cliente_id and o.deleted_at is null
   join pcm.despesas_visita d on d.id=p_despesa_id and d.cliente_id=f.cliente_id
   join pcm.visita_ordens_servico v on v.id=p_vinculo_id and v.cliente_id=d.cliente_id and v.visita_id=d.visita_id and v.os_id=o.id
   where f.id=p_fonte_id and f.cliente_id=p_cliente_id and l.id=p_lista_id for share of f,l,o,d,v;
 if not found or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('custo.ler',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_ant.resultado;
end; $$;
revoke all on function comercial.sso_recibo_correlacao_gasto(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text) from public,anon,authenticated,service_role;
grant execute on function comercial.sso_recibo_correlacao_gasto(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text) to authenticated;
