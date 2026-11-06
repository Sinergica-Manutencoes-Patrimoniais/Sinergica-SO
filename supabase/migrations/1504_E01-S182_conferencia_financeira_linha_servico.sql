-- ADR-1357: leitura limitada às origens conhecidas; não certifica exclusividade.
create function financeiro.sso_conferir_itens_linha_servico(p_cliente_id uuid,p_fato_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_snapshot financeiro.sso_snapshots_servico_extra%rowtype;
  v_declaracoes bigint; v_integrais bigint; v_materiais bigint; v_cancelados bigint; v_ativos bigint;
begin
  perform 1 from financeiro.sso_previa_origem_servico_gate where id and habilitado for share;
  if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_fato_id is null
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select s.* into v_snapshot from financeiro.sso_fatos_execucao_declarados f
    join financeiro.sso_vinculos_resposta_servico v on v.id=f.vinculo_id and v.cliente_id=f.cliente_id and v.resposta_id=f.resposta_id
    join financeiro.sso_snapshots_servico_extra s on s.id=v.snapshot_id and s.cliente_id=f.cliente_id
    where f.id=p_fato_id and f.cliente_id=p_cliente_id;
  if not found then raise exception 'referencia_indisponivel' using errcode='42501'; end if;
  select count(*) into v_declaracoes from financeiro.sso_material_linha_proposta l
    join financeiro.sso_material_declaracoes d on d.id=l.declaracao_id and d.cliente_id=p_cliente_id
    where l.proposta_id=v_snapshot.proposta_id and l.versao=v_snapshot.versao and l.linha_id=v_snapshot.linha_id;
  select count(*) filter(where base.origem_tipo='proposta_operacional'),
    count(*) filter(where base.origem_tipo='material_proposta_linha'),
    count(*) filter(where i.status='cancelado'), count(*) filter(where i.status<>'cancelado')
    into v_integrais,v_materiais,v_cancelados,v_ativos
  from financeiro.itens_faturaveis i
    join financeiro.itens_faturaveis base on base.id=coalesce(i.item_base_id,i.id) and base.cliente_id=i.cliente_id
  where i.cliente_id=p_cliente_id and base.item_base_id is null and (
    (base.origem_tipo='proposta_operacional' and base.origem_id=v_snapshot.proposta_id)
    or (base.origem_tipo='material_proposta_linha' and exists(select 1 from financeiro.sso_material_linha_proposta l
      join financeiro.sso_material_declaracoes d on d.id=l.declaracao_id and d.cliente_id=p_cliente_id
      where l.declaracao_id=base.origem_id and l.proposta_id=v_snapshot.proposta_id and l.versao=v_snapshot.versao and l.linha_id=v_snapshot.linha_id))
  );
  if config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return jsonb_build_object('clienteId',p_cliente_id,'fatoId',p_fato_id,'declaracoesMaterial',v_declaracoes,
    'itensPropostaIntegral',v_integrais,'itensMaterialMesmaLinha',v_materiais,'itensCancelados',v_cancelados,'itensNaoCancelados',v_ativos,
    'exclusividadeComprovada',false,'geraFaturavel',false);
end; $$;
revoke all on function financeiro.sso_conferir_itens_linha_servico(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function financeiro.sso_conferir_itens_linha_servico(uuid,uuid) to authenticated;
