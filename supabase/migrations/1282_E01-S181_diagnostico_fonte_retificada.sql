-- ADR-1124: somente estado mínimo; não é autorização para publicar.
create function comercial.sso_diagnosticar_fonte_retificada(p_ator_id uuid,p_cliente_id uuid,p_proposta_id uuid,p_versao integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_estado text;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_proposta_id is null or p_versao is null or p_versao<1 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from comercial.sso_guarda_fonte_retificada_gate where id and habilitado for share;
 if not found then raise exception 'guarda_fonte_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('custo.ler',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from comercial.propostas p join comercial.proposta_origens_operacionais origem on origem.proposta_id=p.id
  join pcm.listas_materiais l on l.id=origem.lista_materiais_id and l.cliente_id=p_cliente_id
  join pcm.ordens_servico os on os.id=origem.ordem_servico_id and os.id=l.ordem_servico_id and os.client_id=p_cliente_id and os.deleted_at is null
  left join comercial.oportunidades op on op.id=p.oportunidade_id
  where p.id=p_proposta_id and p.deleted_at is null and p.versao_atual=p_versao and (p.oportunidade_id is null or op.cliente_id=p_cliente_id) for share of p,l,os;
 if not found then raise exception 'origem_ou_versao_indisponivel' using errcode='42501'; end if;
 if not exists(select 1 from comercial.sso_composicao_mista_comandos c where c.cliente_id=p_cliente_id and c.payload->>'propostaId'=p_proposta_id::text and c.resultado->>'revision'=p_versao::text) then
  v_estado:='sem_fotografia';
 elsif exists(select 1 from comercial.sso_composicao_mista_comandos c cross join lateral jsonb_array_elements(c.aquisicoes_validadas) f
  join comercial.sso_retificacoes_fonte_aquisicao r on r.fonte_anterior_id=(f->>'fonteId')::uuid
  where c.cliente_id=p_cliente_id and c.payload->>'propostaId'=p_proposta_id::text and c.resultado->>'revision'=p_versao::text) then
  v_estado:='fonte_retificada';
 else v_estado:='sem_retificacao_observada'; end if;
 if config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('custo.ler',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return jsonb_build_object('clienteId',p_cliente_id,'propostaId',p_proposta_id,'versao',p_versao,'estado',v_estado);
end; $$;
revoke all on function comercial.sso_diagnosticar_fonte_retificada(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function comercial.sso_diagnosticar_fonte_retificada(uuid,uuid,uuid,integer) to authenticated;
