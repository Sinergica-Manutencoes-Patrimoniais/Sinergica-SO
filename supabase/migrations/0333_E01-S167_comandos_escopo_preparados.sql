-- ADR-0111: comandos experimentais; gate 0324 fechado e EXECUTE revogado.
-- Não liberar: faltam constraints cross-Cliente, locks de escritores legados e revisão adversarial.
alter table pcm.chamado_escopo_parcelas add column os_atendimento_id uuid references pcm.ordens_servico(id);
alter table pcm.chamado_continuacoes_propostas add column os_continuacao_id uuid references pcm.ordens_servico(id);
alter table pcm.chamados add column sso_encerrado_em timestamptz;
alter table pcm.chamados add column sso_encerrado_por uuid references auth.users(id);

create function pcm.sso_comando_escopo_chamado(
  p_request_id uuid, p_cliente_id uuid, p_chamado_id uuid, p_expected_revision bigint,
  p_acao text, p_item_id uuid, p_descricao text, p_os_id uuid, p_minutos integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_chamado pcm.chamados%rowtype;
  v_anterior pcm.chamado_os_comandos%rowtype;
  v_payload jsonb;
  v_resultado jsonb;
  v_capacidade text;
begin
  if not coalesce((select habilitado from pcm.chamado_os_gate where id), false) then
    raise exception 'comando_bloqueado' using errcode = '55000';
  end if;
  if v_actor is null or p_request_id is null or p_cliente_id is null or p_chamado_id is null
    or p_expected_revision is null or p_expected_revision < 1 or p_acao is null then
    raise exception 'comando_invalido' using errcode = '22023';
  end if;
  v_capacidade := case p_acao
    when 'adicionar_parcela' then 'chamado.escopo.gerir'
    when 'atender_parcela' then 'chamado.escopo.gerir'
    when 'declarar_composicao' then 'chamado.escopo.gerir'
    when 'propor_continuacao' then 'chamado.continuacao.sugerir'
    when 'encerrar' then 'chamado.encerrar'
    else null end;
  if v_capacidade is null then raise exception 'acao_invalida' using errcode = '22023'; end if;
  v_payload := jsonb_build_object('acao', p_acao, 'clienteId', p_cliente_id, 'chamadoId', p_chamado_id,
    'expectedRevision', p_expected_revision, 'itemId', p_item_id, 'descricao', p_descricao,
    'osId', p_os_id, 'minutos', p_minutos);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chamado-os-request:' || p_request_id::text, 0));
  select * into v_anterior from pcm.chamado_os_comandos where request_id = p_request_id;
  if found then
    if v_anterior.actor_id is distinct from v_actor
      or config.sso_autorizar_acao(v_capacidade, v_anterior.cliente_id) is distinct from true then
      raise exception 'chamado_nao_encontrado_ou_sem_acesso' using errcode = '42501';
    end if;
    if v_anterior.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return v_anterior.resultado;
  end if;
  select * into v_chamado from pcm.chamados where id = p_chamado_id for update;
  if not found or v_chamado.deleted_at is not null or v_chamado.cliente_id is distinct from p_cliente_id
    or config.sso_autorizar_acao(v_capacidade, p_cliente_id) is distinct from true then
    raise exception 'chamado_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  if v_chamado.sso_revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if v_chamado.sso_encerrado_em is not null or v_chamado.status = 'cancelado' then
    raise exception 'chamado_nao_editavel' using errcode = '23514';
  end if;
  if p_acao = 'adicionar_parcela' then
    if p_item_id is null or p_descricao is null or length(btrim(p_descricao)) not between 1 and 1000
      or p_os_id is not null or p_minutos is not null then raise exception 'parcela_invalida' using errcode = '22023'; end if;
    insert into pcm.chamado_escopo_parcelas(id, chamado_id, descricao, created_by)
      values (p_item_id, p_chamado_id, btrim(p_descricao), v_actor);
    insert into pcm.chamado_escopo_composicoes(chamado_id, declarada_completa)
      values (p_chamado_id, false) on conflict (chamado_id) do update set declarada_completa = false,
        revisao = pcm.chamado_escopo_composicoes.revisao + 1;
  elsif p_acao = 'atender_parcela' then
    if p_item_id is null or p_os_id is null or p_descricao is not null or p_minutos is not null then
      raise exception 'parcela_invalida' using errcode = '22023'; end if;
    perform 1 from pcm.ordens_servico o where o.id = p_os_id and o.chamado_id = p_chamado_id
      and o.client_id = p_cliente_id and o.deleted_at is null and o.status = 'finalizado' for update;
    if not found then raise exception 'os_nao_finalizada_ou_invalida' using errcode = '23514'; end if;
    update pcm.chamado_escopo_parcelas set situacao = 'atendida', os_atendimento_id = p_os_id
      where id = p_item_id and chamado_id = p_chamado_id and situacao = 'pendente';
    if not found then raise exception 'parcela_nao_disponivel' using errcode = '23514'; end if;
  elsif p_acao = 'declarar_composicao' then
    if p_item_id is not null or p_os_id is not null or p_descricao is not null or p_minutos is not null
      or not exists(select 1 from pcm.chamado_escopo_parcelas where chamado_id = p_chamado_id) then
      raise exception 'composicao_invalida' using errcode = '23514'; end if;
    update pcm.chamado_escopo_composicoes set declarada_completa = true, revisao = revisao + 1
      where chamado_id = p_chamado_id;
    if not found then raise exception 'composicao_inexistente' using errcode = '23514'; end if;
  elsif p_acao = 'propor_continuacao' then
    if p_item_id is null or p_os_id is null or p_descricao is null or length(btrim(p_descricao)) not between 1 and 4000
      or p_minutos is null or p_minutos < 1 then raise exception 'continuacao_invalida' using errcode = '22023'; end if;
    perform 1 from pcm.ordens_servico o where o.id = p_os_id and o.chamado_id = p_chamado_id
      and o.client_id = p_cliente_id and o.deleted_at is null for update;
    if not found then raise exception 'os_invalida' using errcode = '23514'; end if;
    insert into pcm.chamado_continuacoes_propostas(id, chamado_id, os_anterior_id, descricao_restante, minutos_restantes, created_by)
      values (p_item_id, p_chamado_id, p_os_id, btrim(p_descricao), p_minutos, v_actor);
  elsif p_acao = 'encerrar' then
    if p_item_id is not null or p_os_id is not null or p_descricao is not null or p_minutos is not null then
      raise exception 'encerramento_invalido' using errcode = '22023'; end if;
    -- Locks antecipam alterações de OS que respeitem a mesma ordem; escritores antigos ainda não a respeitam.
    perform 1 from pcm.ordens_servico o where o.chamado_id = p_chamado_id and o.deleted_at is null order by o.id for update;
    if not exists(select 1 from pcm.chamado_escopo_composicoes where chamado_id = p_chamado_id and declarada_completa)
      or not exists(select 1 from pcm.chamado_escopo_parcelas where chamado_id = p_chamado_id)
      or exists(select 1 from pcm.chamado_escopo_parcelas where chamado_id = p_chamado_id and (situacao <> 'atendida' or os_atendimento_id is null))
      or exists(select 1 from pcm.chamado_continuacoes_propostas where chamado_id = p_chamado_id and situacao = 'pendente')
      or not exists(select 1 from pcm.ordens_servico where chamado_id = p_chamado_id and deleted_at is null)
      or exists(select 1 from pcm.ordens_servico where chamado_id = p_chamado_id and deleted_at is null and (client_id is distinct from p_cliente_id or status is distinct from 'finalizado')) then
      raise exception 'escopo_nao_atendido' using errcode = '23514'; end if;
  end if;
  update pcm.chamados set updated_at = now(), updated_by = v_actor,
    sso_encerrado_em = case when p_acao = 'encerrar' then now() else sso_encerrado_em end,
    sso_encerrado_por = case when p_acao = 'encerrar' then v_actor else sso_encerrado_por end
    where id = p_chamado_id returning * into v_chamado;
  v_resultado := jsonb_build_object('chamadoId', p_chamado_id, 'revision', v_chamado.sso_revisao,
    'acao', p_acao, 'requestId', p_request_id, 'itemId', p_item_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_actor, 'chamado.escopo_' || p_acao, 'chamados', p_chamado_id, v_resultado);
  insert into pcm.chamado_os_comandos(request_id, actor_id, cliente_id, chamado_id, payload, resultado)
    values (p_request_id, v_actor, p_cliente_id, p_chamado_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_comando_escopo_chamado(uuid, uuid, uuid, bigint, text, uuid, text, uuid, integer)
  from public, anon, authenticated, service_role;

-- Revisão PCM e criação são atômicas; o comando de criação também permanece fechado.
create function pcm.sso_aprovar_continuacao_chamado(
  p_request_id uuid, p_request_criar_id uuid, p_cliente_id uuid, p_chamado_id uuid,
  p_expected_revision bigint, p_proposta_id uuid, p_nova_os_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_chamado pcm.chamados%rowtype;
  v_proposta pcm.chamado_continuacoes_propostas%rowtype;
  v_anterior pcm.chamado_os_comandos%rowtype;
  v_os pcm.ordens_servico%rowtype;
  v_payload jsonb; v_criacao jsonb; v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.chamado_os_gate where id), false) then
    raise exception 'comando_bloqueado' using errcode = '55000'; end if;
  if v_actor is null or p_request_id is null or p_request_criar_id is null or p_request_id = p_request_criar_id
    or p_cliente_id is null or p_chamado_id is null or p_expected_revision is null or p_expected_revision < 1
    or p_proposta_id is null or p_nova_os_id is null then
    raise exception 'comando_invalido' using errcode = '22023'; end if;
  v_payload := jsonb_build_object('acao', 'aprovar_continuacao', 'clienteId', p_cliente_id,
    'chamadoId', p_chamado_id, 'expectedRevision', p_expected_revision, 'propostaId', p_proposta_id,
    'novaOsId', p_nova_os_id, 'requestCriarId', p_request_criar_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chamado-os-request:' || p_request_id::text, 0));
  select * into v_anterior from pcm.chamado_os_comandos where request_id = p_request_id;
  if found then
    if v_anterior.actor_id is distinct from v_actor
      or config.sso_autorizar_acao('execucao.validar', v_anterior.cliente_id) is distinct from true
      or config.sso_autorizar_acao('chamado.os.criar', v_anterior.cliente_id) is distinct from true then
      raise exception 'chamado_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
    if v_anterior.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_anterior.resultado;
  end if;
  select * into v_chamado from pcm.chamados where id = p_chamado_id for update;
  if not found or v_chamado.deleted_at is not null or v_chamado.cliente_id is distinct from p_cliente_id
    or config.sso_autorizar_acao('execucao.validar', p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('chamado.os.criar', p_cliente_id) is distinct from true then
    raise exception 'chamado_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  if v_chamado.sso_revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if v_chamado.sso_encerrado_em is not null or v_chamado.status = 'cancelado' then
    raise exception 'chamado_nao_editavel' using errcode = '23514'; end if;
  select * into v_proposta from pcm.chamado_continuacoes_propostas
    where id = p_proposta_id and chamado_id = p_chamado_id for update;
  if not found or v_proposta.situacao <> 'pendente' then raise exception 'proposta_nao_disponivel' using errcode = '23514'; end if;
  select * into v_os from pcm.ordens_servico where id = v_proposta.os_anterior_id
    and chamado_id = p_chamado_id and client_id = p_cliente_id and deleted_at is null for update;
  if not found or v_os.status <> 'finalizado' then raise exception 'os_anterior_nao_finalizada' using errcode = '23514'; end if;
  v_criacao := pcm.sso_criar_os_chamado(p_request_criar_id, p_expected_revision, p_chamado_id,
    p_cliente_id, p_nova_os_id, v_os.titulo, v_proposta.descricao_restante, v_os.categoria);
  update pcm.chamado_continuacoes_propostas set situacao = 'executada', os_continuacao_id = p_nova_os_id
    where id = p_proposta_id;
  v_resultado := jsonb_build_object('requestId', p_request_id, 'propostaId', p_proposta_id,
    'osAnteriorId', v_os.id, 'osContinuacaoId', p_nova_os_id, 'minutosRestantes', v_proposta.minutos_restantes,
    'revision', (v_criacao->>'revision')::bigint);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_actor, 'chamado.continuacao_aprovada', 'chamados', p_chamado_id, v_resultado);
  insert into pcm.chamado_os_comandos(request_id, actor_id, cliente_id, chamado_id, payload, resultado)
    values (p_request_id, v_actor, p_cliente_id, p_chamado_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_aprovar_continuacao_chamado(uuid, uuid, uuid, uuid, bigint, uuid, uuid)
  from public, anon, authenticated, service_role;
