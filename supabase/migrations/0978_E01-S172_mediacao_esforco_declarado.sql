-- ADR-0773: mediação de fonte declarada, gate permanece fechado.
create function pcm.sso_mediar_declaracao_esforco(
  p_request_id uuid, p_cliente_id uuid, p_origem_tipo text, p_origem_id uuid, p_expected_revision integer,
  p_internos_minutos integer, p_terceiros_minutos integer, p_acompanhamento_minutos integer, p_justificativa text
) returns jsonb language sql security definer set search_path = '' as $$
  select pcm.sso_declarar_esforco_capacidade(p_request_id,p_cliente_id,p_origem_tipo,p_origem_id,p_expected_revision,
    p_internos_minutos,p_terceiros_minutos,p_acompanhamento_minutos,p_justificativa);
$$;
create function pcm.sso_consultar_esforco_declarado(p_cliente_id uuid,p_origem_tipo text,p_origem_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_declaracao pcm.capacidade_esforco_declaracoes%rowtype;
begin
  if not coalesce((select habilitado from pcm.capacidade_esforco_declarado_gate where id),false) then
    raise exception 'esforco_capacidade_bloqueado' using errcode='55000';
  end if;
  if auth.uid() is null or p_cliente_id is null or p_origem_id is null or p_origem_tipo is null
     or p_origem_tipo not in ('os','ocorrencia')
     or config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode='42501';
  end if;
  if p_origem_tipo='os' then
    perform 1 from pcm.ordens_servico o where o.id=p_origem_id and o.client_id=p_cliente_id and o.deleted_at is null;
  else
    perform 1 from pcm.ocorrencias_rotina_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id
      where o.id=p_origem_id and p.cliente_id=p_cliente_id;
  end if;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_declaracao from pcm.capacidade_esforco_declaracoes
    where cliente_id=p_cliente_id and ((p_origem_tipo='os' and os_id=p_origem_id) or (p_origem_tipo='ocorrencia' and ocorrencia_id=p_origem_id))
    order by revisao desc limit 1;
  return jsonb_build_object('origemTipo',p_origem_tipo,'origemId',p_origem_id,
    'revision',coalesce(v_declaracao.revisao,0),'internosMinutos',v_declaracao.internos_minutos,
    'terceirosMinutos',v_declaracao.terceiros_minutos,'acompanhamentoMinutos',v_declaracao.acompanhamento_minutos);
end; $$;
revoke all on function pcm.sso_mediar_declaracao_esforco(uuid,uuid,text,uuid,integer,integer,integer,integer,text) from public,anon,service_role;
revoke all on function pcm.sso_consultar_esforco_declarado(uuid,text,uuid) from public,anon,service_role;
grant execute on function pcm.sso_mediar_declaracao_esforco(uuid,uuid,text,uuid,integer,integer,integer,integer,text) to authenticated;
grant execute on function pcm.sso_consultar_esforco_declarado(uuid,text,uuid) to authenticated;
