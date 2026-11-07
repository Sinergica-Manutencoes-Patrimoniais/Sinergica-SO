-- ADR-1358: leitura da classificação interna da linha congelada no fato.
create function financeiro.sso_classificacao_fato_servico(p_cliente_id uuid,p_fato_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_snapshot financeiro.sso_snapshots_servico_extra%rowtype;
  v_class comercial.sso_classificacoes_linha%rowtype; v_revisao comercial.sso_revisoes_classificacao_linha%rowtype;
  v_atual boolean;
begin
  perform 1 from financeiro.sso_previa_origem_servico_gate where id and habilitado for share;
  if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
  perform 1 from comercial.sso_classificacao_linha_gate where id and habilitado for share;
  if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_fato_id is null
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select s.* into v_snapshot from financeiro.sso_fatos_execucao_declarados f
    join financeiro.sso_vinculos_resposta_servico v on v.id=f.vinculo_id and v.cliente_id=f.cliente_id and v.resposta_id=f.resposta_id
    join financeiro.sso_snapshots_servico_extra s on s.id=v.snapshot_id and s.cliente_id=f.cliente_id
    where f.id=p_fato_id and f.cliente_id=p_cliente_id;
  if not found then raise exception 'referencia_indisponivel' using errcode='42501'; end if;
  select c.* into v_class from comercial.sso_classificacoes_linha c where c.cliente_id=p_cliente_id
    and c.proposta_id=v_snapshot.proposta_id and c.versao=v_snapshot.versao and c.linha_id=v_snapshot.linha_id;
  if v_class.id is not null then
    select r.* into v_revisao from comercial.sso_revisoes_classificacao_linha r where r.classificacao_id=v_class.id;
  end if;
  select exists(select 1 from comercial.propostas p where p.id=v_snapshot.proposta_id and p.deleted_at is null
    and p.status='aceita' and p.versao_atual=v_snapshot.versao) into v_atual;
  if config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return jsonb_build_object('clienteId',p_cliente_id,'fatoId',p_fato_id,'propostaId',v_snapshot.proposta_id,
    'versao',v_snapshot.versao,'linhaId',v_snapshot.linha_id,'tipo',v_class.tipo,'decisao',v_revisao.decisao,
    'propostaAtual',v_atual,'execucaoFisicaComprovada',false,'exclusividadeComprovada',false,'geraFaturavel',false);
end; $$;
revoke all on function financeiro.sso_classificacao_fato_servico(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function financeiro.sso_classificacao_fato_servico(uuid,uuid) to authenticated;
