-- ADR-1375: somente identidade e vínculos; não devolve evidências ou autoriza cobrança.
create function financeiro.sso_rastrear_candidato_servico(p_cliente_id uuid,p_item_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_fato uuid; v_declaracao uuid; v_snapshot uuid; v_os uuid; v_proposta uuid; v_versao integer; v_linha uuid; v_revisao_pcm uuid;
begin
 if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from financeiro.sso_leitura_fato_servico_gate where id and habilitado for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_item_id is null
   or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select f.id,d.id,s.id,d.os_id,s.proposta_id,s.versao,s.linha_id,f.revisao_id
 into v_fato,v_declaracao,v_snapshot,v_os,v_proposta,v_versao,v_linha,v_revisao_pcm
 from financeiro.itens_faturaveis i
 join financeiro.sso_candidatos_servico c on c.item_id=i.id and c.cliente_id=i.cliente_id and c.fato_id=i.origem_id
 join financeiro.sso_fatos_execucao_declarados f on f.id=c.fato_id and f.cliente_id=c.cliente_id
 join financeiro.sso_vinculos_resposta_servico v on v.id=f.vinculo_id and v.cliente_id=f.cliente_id and v.resposta_id=f.resposta_id
 join financeiro.sso_snapshots_servico_extra s on s.id=v.snapshot_id and s.cliente_id=f.cliente_id
 join financeiro.sso_servicos_extra_declarados d on d.id=s.declaracao_id and d.cliente_id=s.cliente_id and d.proposta_id=s.proposta_id and d.versao=s.versao and d.linha_id=s.linha_id
 join pcm.retorno_os_preparado ro on ro.id=f.retorno_id and ro.cliente_id=f.cliente_id and ro.os_id=d.os_id
 where i.id=p_item_id and i.cliente_id=p_cliente_id and i.origem_tipo='servico_extra_fato' and i.item_base_id is null;
 if not found then raise exception 'origem_indisponivel_ou_inconsistente' using errcode='42501'; end if;
 if config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return jsonb_build_object('clienteId',p_cliente_id,'itemId',p_item_id,'fatoId',v_fato,'declaracaoId',v_declaracao,
   'snapshotId',v_snapshot,'osId',v_os,'propostaId',v_proposta,'versao',v_versao,'linhaId',v_linha,'revisaoPcmId',v_revisao_pcm,
   'execucaoFisicaComprovada',false,'exclusividadeComprovada',false,'autorizaFaturamento',false);
end; $$;
revoke all on function financeiro.sso_rastrear_candidato_servico(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function financeiro.sso_rastrear_candidato_servico(uuid,uuid) to authenticated;
