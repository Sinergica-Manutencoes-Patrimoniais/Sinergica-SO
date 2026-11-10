-- ADR-0115: protótipo fechado. Nenhum papel de aplicação recebe EXECUTE.
create table comercial.sso_orcamento_operacional_comandos (
  request_id uuid primary key,
  ator_id uuid not null references config.usuarios(user_id),
  payload jsonb not null,
  resultado jsonb not null,
  criado_em timestamptz not null default now()
);
alter table comercial.sso_orcamento_operacional_comandos enable row level security;
alter table comercial.sso_orcamento_operacional_comandos force row level security;
revoke all on comercial.sso_orcamento_operacional_comandos from public, anon, authenticated, service_role;

create function comercial.sso_preparar_orcamento_operacional(
  p_request_id uuid, p_proposta_id uuid, p_expected_revision integer,
  p_lista_id uuid, p_lista_revision integer, p_descricao text,
  p_custo_aquisicao_centavos bigint, p_custos_operacionais_centavos bigint,
  p_fator numeric, p_preco_centavos bigint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ator uuid := auth.uid(); v_proposta comercial.propostas%rowtype;
  v_lista pcm.listas_materiais%rowtype; v_cliente uuid;
  v_vinculo comercial.proposta_origens_operacionais%rowtype;
  v_anterior comercial.sso_orcamento_operacional_comandos%rowtype;
  v_payload jsonb; v_resultado jsonb; v_itens jsonb; v_custo bigint; v_sugerido bigint; v_piso bigint;
begin
  if p_request_id is null or p_proposta_id is null or p_lista_id is null or p_expected_revision is null
    or p_expected_revision < 1 or p_lista_revision is null or p_lista_revision < 1
    or p_descricao is null or length(btrim(p_descricao)) not between 1 and 4000
    or p_custo_aquisicao_centavos is null or p_custos_operacionais_centavos is null or p_preco_centavos is null
    or p_custo_aquisicao_centavos not between 0 and 1000000000000
    or p_custos_operacionais_centavos not between 0 and 1000000000000
    or p_preco_centavos not between 0 and 1000000000000
    or p_fator is null or p_fator < 1 or p_fator > 100 or scale(p_fator) > 4 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_proposta from comercial.propostas where id = p_proposta_id and deleted_at is null for update;
  if not found then raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  select o.cliente_id into v_cliente from comercial.oportunidades o
    where o.id = v_proposta.oportunidade_id and o.deleted_at is null for share;
  if not found then raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  select * into v_lista from pcm.listas_materiais where id = p_lista_id for update;
  if not found or v_lista.cliente_id is distinct from v_cliente or v_lista.responsavel <> 'sinergica' then
    raise exception 'origem_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  perform 1 from pcm.ordens_servico os where os.id = v_lista.ordem_servico_id
    and os.client_id = v_cliente and os.deleted_at is null for share;
  if not found or config.sso_autorizar_acao('orcamento.emitir', v_cliente) is not true
    or config.sso_autorizar_acao('custo.ler', v_cliente) is not true
    or config.sso_autorizar_acao('material.gerir', v_cliente) is not true then
    raise exception 'origem_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  perform comercial._fn_guarda_comercial_escrita();
  v_payload := jsonb_build_object('propostaId', p_proposta_id, 'expectedRevision', p_expected_revision,
    'listaId', p_lista_id, 'listaRevision', p_lista_revision, 'descricao', p_descricao,
    'custoAquisicao', p_custo_aquisicao_centavos, 'custosOperacionais', p_custos_operacionais_centavos,
    'fator', p_fator, 'preco', p_preco_centavos);
  select * into v_anterior from comercial.sso_orcamento_operacional_comandos where request_id = p_request_id;
  if found then
    if v_anterior.ator_id is distinct from v_ator or v_anterior.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return v_anterior.resultado;
  end if;
  if v_proposta.status <> 'rascunho' or v_proposta.versao_atual <> p_expected_revision
    or v_lista.revisao <> p_lista_revision then raise exception 'revisao_ou_estado_invalido' using errcode = '40001'; end if;
  select * into v_vinculo from comercial.proposta_origens_operacionais where proposta_id = p_proposta_id;
  if found and (v_vinculo.lista_materiais_id <> p_lista_id or v_vinculo.ordem_servico_id <> v_lista.ordem_servico_id) then
    raise exception 'origem_conflitante' using errcode = '23505';
  end if;
  v_custo := p_custo_aquisicao_centavos + p_custos_operacionais_centavos;
  v_sugerido := round(p_custo_aquisicao_centavos::numeric * p_fator + p_custos_operacionais_centavos)::bigint;
  if v_sugerido > 1000000000000 then raise exception 'valor_invalido' using errcode = '22023'; end if;
  v_piso := greatest(v_proposta.piso_centavos, v_custo);
  if p_preco_centavos < v_piso then raise exception 'preco_abaixo_piso' using errcode = '23514'; end if;
  v_itens := jsonb_build_array(jsonb_build_object('tipo', 'material', 'descricao', p_descricao,
    'quantidade', 1, 'custo_unitario_centavos', p_custo_aquisicao_centavos, 'total_centavos', p_custo_aquisicao_centavos));
  if p_custos_operacionais_centavos > 0 then
    v_itens := v_itens || jsonb_build_array(jsonb_build_object('tipo', 'outro', 'descricao', 'Custos operacionais',
      'quantidade', 1, 'custo_unitario_centavos', p_custos_operacionais_centavos, 'total_centavos', p_custos_operacionais_centavos));
  end if;
  if v_vinculo.proposta_id is null then
    insert into comercial.proposta_origens_operacionais(proposta_id, ordem_servico_id, lista_materiais_id, criado_por)
      values (p_proposta_id, v_lista.ordem_servico_id, p_lista_id, v_ator);
  end if;
  v_proposta := comercial.fn_salvar_composicao_proposta(p_proposta_id, v_itens, v_custo, v_piso,
    v_sugerido, p_preco_centavos, p_descricao, null, null);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_ator, 'orcamento_operacional.preparado', 'propostas', p_proposta_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_cliente, 'revision', v_proposta.versao_atual));
  v_resultado := jsonb_build_object('aggregateId', p_proposta_id, 'revision', v_proposta.versao_atual,
    'state', v_proposta.status, 'created', false, 'linkedIds', jsonb_build_object('listaId', p_lista_id, 'ordemServicoId', v_lista.ordem_servico_id),
    'warnings', '[]'::jsonb, 'requestId', p_request_id);
  insert into comercial.sso_orcamento_operacional_comandos(request_id, ator_id, payload, resultado)
    values (p_request_id, v_ator, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function comercial.sso_preparar_orcamento_operacional(uuid, uuid, integer, uuid, integer, text, bigint, bigint, numeric, bigint) from public, anon, authenticated, service_role;
