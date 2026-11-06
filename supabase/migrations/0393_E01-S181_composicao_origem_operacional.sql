-- ADR-0167: adaptação aditiva; gate permanece fechado, RPC revogada.
create or replace function comercial.sso_preparar_orcamento_operacional(
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
  if v_proposta.oportunidade_id is null then
    if not coalesce((select g.habilitado from comercial.sso_origem_operacional_gate g where g.id), false) then
      raise exception 'origem_operacional_indisponivel' using errcode = '55000'; end if;
    select l.cliente_id into v_cliente from comercial.proposta_origens_operacionais origem
      join pcm.listas_materiais l on l.id = origem.lista_materiais_id
      join pcm.ordens_servico os on os.id = origem.ordem_servico_id and os.id = l.ordem_servico_id
        and os.client_id = l.cliente_id and os.deleted_at is null
      where origem.proposta_id = p_proposta_id and l.id = p_lista_id for share of l, os;
  else
    select o.cliente_id into v_cliente from comercial.oportunidades o
      where o.id = v_proposta.oportunidade_id and o.deleted_at is null for share;
  end if;
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

-- Adaptadores públicos permanecem revogados e a origem nova sujeita ao mesmo gate.
create or replace function comercial.sso_portal_propostas_os(p_cliente_id uuid, p_os_id uuid, p_apos uuid default null)
returns table(id uuid, ordem_servico_id uuid, status text, versao integer, valido_ate date, payload jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_os_id is null or not exists (
    select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id = uc.user_id
    where uc.user_id = auth.uid() and uc.cliente_id = p_cliente_id and u.ativo and u.papel = 'cliente-sindico'
  ) or not exists (select 1 from pcm.ordens_servico os where os.id = p_os_id and os.client_id = p_cliente_id and os.deleted_at is null) then
    raise exception 'ordem_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  return query select p.id, origem.ordem_servico_id, p.status, p.versao_atual, p.valido_ate,
    comercial.projecao_proposta_publica(v.payload)
    from comercial.proposta_origens_operacionais origem
    join comercial.propostas p on p.id = origem.proposta_id and p.deleted_at is null
    join pcm.listas_materiais l on l.id = origem.lista_materiais_id and l.cliente_id = p_cliente_id and l.ordem_servico_id = p_os_id
    left join comercial.oportunidades o on o.id = p.oportunidade_id and o.cliente_id = p_cliente_id and o.deleted_at is null
    join comercial.proposta_versoes v on v.proposta_id = p.id and v.versao = p.versao_atual
    where origem.ordem_servico_id = p_os_id
      and ((p.oportunidade_id is not null and o.id is not null) or
        (p.oportunidade_id is null and coalesce((select g.habilitado from comercial.sso_origem_operacional_gate g where g.id), false)))
      and p.status in ('enviada', 'aceita', 'recusada')
      and (p_apos is null or p.id > p_apos) order by p.id limit 20;
end;
$$;
revoke all on function comercial.sso_portal_propostas_os(uuid, uuid, uuid) from public, anon, authenticated, service_role;

create or replace function comercial.sso_portal_decidir_proposta_versionada(p_request_id uuid, p_proposta_id uuid,
  p_versao integer, p_decisao text, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_proposta comercial.propostas%rowtype; v_cliente uuid; v_payload jsonb; v_resultado jsonb;
  v_comando comercial.sso_portal_proposta_comandos%rowtype; v_status jsonb;
begin
  if auth.uid() is null or p_request_id is null or p_proposta_id is null or p_versao is null or p_versao < 1
    or p_decisao is null or p_decisao not in ('aceita', 'recusada') or length(coalesce(p_motivo, '')) > 2000
    or (p_decisao = 'recusada' and nullif(btrim(p_motivo), '') is null) then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('portal-proposta:' || p_request_id::text, 0));
  select * into v_proposta from comercial.propostas where id = p_proposta_id and deleted_at is null for update;
  if not found then raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  if v_proposta.oportunidade_id is null then
    if not coalesce((select g.habilitado from comercial.sso_origem_operacional_gate g where g.id), false) then
      raise exception 'origem_operacional_indisponivel' using errcode = '55000'; end if;
    select l.cliente_id into v_cliente from comercial.proposta_origens_operacionais origem
      join pcm.listas_materiais l on l.id = origem.lista_materiais_id
      join pcm.ordens_servico os on os.id = origem.ordem_servico_id and os.id = l.ordem_servico_id
        and os.client_id = l.cliente_id and os.deleted_at is null
      where origem.proposta_id = p_proposta_id for share of l, os;
  else
    select o.cliente_id into v_cliente from comercial.oportunidades o
      where o.id = v_proposta.oportunidade_id and o.deleted_at is null for share;
  end if;
  if v_cliente is null or auth.jwt()->>'user_role' is distinct from 'cliente-sindico'
    or auth.jwt()->>'cliente_id' is distinct from v_cliente::text or not exists (
      select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id = uc.user_id
      where uc.user_id = auth.uid() and uc.cliente_id = v_cliente and u.ativo and u.papel = 'cliente-sindico')
    or not exists (select 1 from comercial.proposta_origens_operacionais origem
      join pcm.ordens_servico os on os.id = origem.ordem_servico_id and os.client_id = v_cliente and os.deleted_at is null
      where origem.proposta_id = p_proposta_id) then
    raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  v_payload := jsonb_build_object('propostaId', p_proposta_id, 'versao', p_versao,
    'decisao', p_decisao, 'motivo', nullif(btrim(p_motivo), ''));
  select * into v_comando from comercial.sso_portal_proposta_comandos where request_id = p_request_id;
  if found then
    if v_comando.ator_id is distinct from auth.uid() or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if v_proposta.versao_atual <> p_versao then raise exception 'versao_obsoleta' using errcode = '40001'; end if;
  if v_proposta.status <> 'enviada' then raise exception 'decisao_ja_registrada' using errcode = '23505'; end if;
  if v_proposta.valido_ate is not null and v_proposta.valido_ate < current_date then
    raise exception 'proposta_expirada' using errcode = '23514'; end if;
  if not exists (select 1 from comercial.proposta_versoes v where v.proposta_id = p_proposta_id and v.versao = p_versao) then
    raise exception 'versao_nao_encontrada' using errcode = '23514'; end if;
  if v_proposta.oportunidade_id is null then
    insert into comercial.proposta_decisoes(proposta_id, cliente_id, decisao, motivo, autor_user_id)
      values (p_proposta_id, v_cliente, p_decisao, nullif(btrim(p_motivo), ''), auth.uid());
    update comercial.propostas set status = p_decisao, updated_at = now(), updated_by = auth.uid()
      where id = p_proposta_id;
    v_status := jsonb_build_object('status', p_decisao);
  else
    v_status := comercial.portal_decidir_proposta(p_proposta_id, p_decisao, nullif(btrim(p_motivo), ''));
  end if;
  if v_status->>'status' is distinct from p_decisao then raise exception 'decisao_nao_confirmada' using errcode = '23514'; end if;
  v_resultado := jsonb_build_object('aggregateId', p_proposta_id, 'revision', p_versao,
    'state', p_decisao, 'requestId', p_request_id);
  insert into comercial.sso_portal_proposta_comandos(request_id, ator_id, payload, resultado)
    values (p_request_id, auth.uid(), v_payload, v_resultado);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'proposta.decisao_portal_versionada', 'propostas', p_proposta_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_cliente, 'version', p_versao, 'decisao', p_decisao));
  return v_resultado;
end;
$$;
revoke all on function comercial.sso_portal_decidir_proposta_versionada(uuid, uuid, integer, text, text)
  from public, anon, authenticated, service_role;


