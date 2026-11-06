-- ADR-0160: cria apenas rascunho canônico com oportunidade legítima; fechado.
create function comercial.sso_listar_oportunidades_orcamento(p_cliente_id uuid, p_apos uuid default null)
returns table(id uuid, titulo text) language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_cliente_id is null
    or config.sso_autorizar_acao('orcamento.emitir', p_cliente_id) is not true
    or config.sso_autorizar_acao('custo.ler', p_cliente_id) is not true
    or config.sso_autorizar_acao('material.gerir', p_cliente_id) is not true then
    raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  perform comercial._fn_guarda_comercial_escrita();
  return query select o.id, o.titulo from comercial.oportunidades o
    where o.cliente_id = p_cliente_id and o.deleted_at is null and o.fechada_em is null
      and (p_apos is null or o.id > p_apos) order by o.id limit 20;
end;
$$;
revoke all on function comercial.sso_listar_oportunidades_orcamento(uuid, uuid)
  from public, anon, authenticated, service_role;

create function comercial.sso_criar_orcamento_operacional(p_request_id uuid, p_oportunidade_id uuid,
  p_lista_id uuid, p_lista_revision integer) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_lista pcm.listas_materiais%rowtype; v_cliente uuid; v_proposta comercial.propostas%rowtype;
  v_anterior comercial.sso_orcamento_operacional_comandos%rowtype; v_payload jsonb; v_resultado jsonb;
begin
  if auth.uid() is null or p_request_id is null or p_oportunidade_id is null or p_lista_id is null
    or p_lista_revision is null or p_lista_revision < 1 then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('orcamento-operacional:' || p_request_id::text, 0));
  select * into v_lista from pcm.listas_materiais where id = p_lista_id for update;
  if not found or v_lista.responsavel <> 'sinergica'
    or config.sso_autorizar_acao('orcamento.emitir', v_lista.cliente_id) is not true
    or config.sso_autorizar_acao('custo.ler', v_lista.cliente_id) is not true
    or config.sso_autorizar_acao('material.gerir', v_lista.cliente_id) is not true
    or not exists (select 1 from pcm.ordens_servico os where os.id = v_lista.ordem_servico_id
      and os.client_id = v_lista.cliente_id and os.deleted_at is null) then
    raise exception 'origem_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  perform comercial._fn_guarda_comercial_escrita();
  v_payload := jsonb_build_object('operacao', 'criar_operacional', 'oportunidadeId', p_oportunidade_id,
    'listaId', p_lista_id, 'listaRevision', p_lista_revision);
  select * into v_anterior from comercial.sso_orcamento_operacional_comandos where request_id = p_request_id;
  if found then
    if v_anterior.ator_id is distinct from auth.uid() or v_anterior.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_anterior.resultado;
  end if;
  if v_lista.revisao <> p_lista_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  select o.cliente_id into v_cliente from comercial.oportunidades o where o.id = p_oportunidade_id
    and o.deleted_at is null and o.fechada_em is null for share;
  if v_cliente is distinct from v_lista.cliente_id then raise exception 'origem_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  if exists (select 1 from comercial.proposta_origens_operacionais origem
    join comercial.propostas p on p.id = origem.proposta_id and p.deleted_at is null and p.status <> 'cancelada'
    where origem.lista_materiais_id = p_lista_id) then raise exception 'proposta_ativa_existente' using errcode = '23505'; end if;
  v_proposta := comercial.fn_criar_proposta(p_oportunidade_id, 'simples');
  insert into comercial.proposta_origens_operacionais(proposta_id, ordem_servico_id, lista_materiais_id, criado_por)
    values (v_proposta.id, v_lista.ordem_servico_id, p_lista_id, auth.uid());
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'orcamento_operacional.criado', 'propostas', v_proposta.id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_lista.cliente_id,
        'listaId', p_lista_id, 'osId', v_lista.ordem_servico_id, 'revision', v_proposta.versao_atual));
  v_resultado := jsonb_build_object('aggregateId', v_proposta.id, 'revision', v_proposta.versao_atual,
    'state', v_proposta.status, 'created', true, 'linkedIds', jsonb_build_object('listaId', p_lista_id,
      'ordemServicoId', v_lista.ordem_servico_id, 'oportunidadeId', p_oportunidade_id),
    'warnings', '[]'::jsonb, 'requestId', p_request_id);
  insert into comercial.sso_orcamento_operacional_comandos(request_id, ator_id, payload, resultado)
    values (p_request_id, auth.uid(), v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function comercial.sso_criar_orcamento_operacional(uuid, uuid, uuid, integer)
  from public, anon, authenticated, service_role;
