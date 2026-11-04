-- ADR-0170. Sem grant; status enviado significa publicação, não mensagem externa.
create table comercial.sso_orcamento_publicacoes (
  proposta_id uuid not null references comercial.propostas(id), versao integer not null check (versao > 0),
  payload_publico jsonb not null check (jsonb_typeof(payload_publico) = 'object'),
  autor_id uuid not null references config.usuarios(user_id), publicado_em timestamptz not null default now(),
  primary key (proposta_id, versao)
);
alter table comercial.sso_orcamento_publicacoes enable row level security;
alter table comercial.sso_orcamento_publicacoes force row level security;
revoke all on comercial.sso_orcamento_publicacoes from public, anon, authenticated, service_role;

create function comercial.sso_transicionar_orcamento_sem_oportunidade(p_request_id uuid, p_proposta_id uuid,
  p_versao integer, p_estado_esperado text, p_acao text, p_escopo_publico text default null,
  p_descricao_publica text default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_proposta comercial.propostas%rowtype; v_cliente uuid; v_lista uuid; v_os uuid;
  v_anterior comercial.sso_orcamento_operacional_comandos%rowtype; v_payload jsonb; v_resultado jsonb;
  v_destino text; v_publico jsonb;
begin
  if auth.uid() is null or p_request_id is null or p_proposta_id is null or p_versao is null or p_versao < 1
    or p_estado_esperado is null or p_acao is null or p_acao not in ('revisar', 'aprovar', 'publicar') then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  if p_acao = 'publicar' then
    if p_escopo_publico is null or length(btrim(p_escopo_publico)) not between 1 and 4000
      or p_descricao_publica is null or length(btrim(p_descricao_publica)) not between 1 and 1000 then
      raise exception 'descricao_publica_invalida' using errcode = '22023'; end if;
  elsif p_escopo_publico is not null or p_descricao_publica is not null then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('orcamento-operacional:' || p_request_id::text, 0));
  select * into v_proposta from comercial.propostas where id = p_proposta_id and deleted_at is null for update;
  if not found or v_proposta.oportunidade_id is not null then
    raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  select l.cliente_id, l.id, os.id into v_cliente, v_lista, v_os from comercial.proposta_origens_operacionais origem
    join pcm.listas_materiais l on l.id = origem.lista_materiais_id
    join pcm.ordens_servico os on os.id = origem.ordem_servico_id and os.id = l.ordem_servico_id
      and os.client_id = l.cliente_id and os.deleted_at is null
    where origem.proposta_id = p_proposta_id for share of l, os;
  if v_cliente is null or config.sso_autorizar_acao('orcamento.emitir', v_cliente) is not true
    or config.sso_autorizar_acao('custo.ler', v_cliente) is not true then
    raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  perform comercial._fn_guarda_comercial_escrita();
  v_payload := jsonb_build_object('operacao', 'transicionar_sem_oportunidade', 'propostaId', p_proposta_id,
    'versao', p_versao, 'estadoEsperado', p_estado_esperado, 'acao', p_acao,
    'escopoPublico', p_escopo_publico, 'descricaoPublica', p_descricao_publica);
  select * into v_anterior from comercial.sso_orcamento_operacional_comandos where request_id = p_request_id;
  if found then
    if v_anterior.ator_id is distinct from auth.uid() or v_anterior.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_anterior.resultado;
  end if;
  if not coalesce((select g.habilitado from comercial.sso_origem_operacional_gate g where g.id), false) then
    raise exception 'origem_operacional_indisponivel' using errcode = '55000'; end if;
  if v_proposta.versao_atual <> p_versao or v_proposta.status <> p_estado_esperado then
    raise exception 'revisao_ou_estado_obsoleto' using errcode = '40001'; end if;
  v_destino := case p_acao when 'revisar' then 'em_revisao' when 'aprovar' then 'aprovada' else 'enviada' end;
  if (p_acao = 'revisar' and p_estado_esperado <> 'rascunho')
    or (p_acao = 'aprovar' and p_estado_esperado <> 'em_revisao')
    or (p_acao = 'publicar' and p_estado_esperado <> 'aprovada') then
    raise exception 'transicao_invalida' using errcode = '23514'; end if;
  if not exists (select 1 from comercial.proposta_versoes v where v.proposta_id = p_proposta_id and v.versao = p_versao)
    or not exists (select 1 from comercial.proposta_itens i where i.proposta_id = p_proposta_id)
    or v_proposta.preco_centavos < v_proposta.piso_centavos then
    raise exception 'proposta_incompleta_ou_abaixo_piso' using errcode = '23514'; end if;
  if p_acao = 'publicar' then
    if v_proposta.valido_ate is not null and v_proposta.valido_ate < current_date then
      raise exception 'proposta_expirada' using errcode = '23514'; end if;
    v_publico := jsonb_build_object('proposta', jsonb_strip_nulls(jsonb_build_object(
      'tipo', v_proposta.tipo, 'escopo', btrim(p_escopo_publico), 'preco_centavos', v_proposta.preco_centavos,
      'valido_ate', v_proposta.valido_ate, 'versao_atual', p_versao)),
      'itens', jsonb_build_array(jsonb_build_object('descricao', btrim(p_descricao_publica))));
    insert into comercial.sso_orcamento_publicacoes(proposta_id, versao, payload_publico, autor_id)
      values (p_proposta_id, p_versao, v_publico, auth.uid());
  end if;
  update comercial.propostas set status = v_destino, updated_by = auth.uid(), updated_at = now() where id = p_proposta_id;
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'orcamento_operacional.' || p_acao, 'propostas', p_proposta_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_cliente, 'osId', v_os, 'listaId', v_lista, 'versao', p_versao));
  v_resultado := jsonb_build_object('aggregateId', p_proposta_id, 'revision', p_versao, 'state', v_destino,
    'requestId', p_request_id);
  insert into comercial.sso_orcamento_operacional_comandos(request_id, ator_id, payload, resultado)
    values (p_request_id, auth.uid(), v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function comercial.sso_transicionar_orcamento_sem_oportunidade(uuid, uuid, integer, text, text, text, text)
  from public, anon, authenticated, service_role;

create function comercial.sso_orcamento_sem_oportunidade(p_proposta_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_cliente uuid; v_sem_oportunidade boolean;
begin
  select l.cliente_id, p.oportunidade_id is null into v_cliente, v_sem_oportunidade
    from comercial.propostas p join comercial.proposta_origens_operacionais origem on origem.proposta_id = p.id
    join pcm.listas_materiais l on l.id = origem.lista_materiais_id
    join pcm.ordens_servico os on os.id = origem.ordem_servico_id and os.id = l.ordem_servico_id
      and os.client_id = l.cliente_id and os.deleted_at is null
    where p.id = p_proposta_id and p.deleted_at is null;
  if v_cliente is null or config.sso_autorizar_acao('orcamento.emitir', v_cliente) is not true
    or config.sso_autorizar_acao('custo.ler', v_cliente) is not true then
    raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  return v_sem_oportunidade;
end;
$$;
revoke all on function comercial.sso_orcamento_sem_oportunidade(uuid) from public, anon, authenticated, service_role;

create function comercial.sso_preco_orcamento_operacional(p_proposta_id uuid)
returns table(versao integer, status text, preco_centavos bigint, valido_ate date)
language plpgsql stable security definer set search_path = '' as $$
begin
  if comercial.sso_orcamento_sem_oportunidade(p_proposta_id) is not true then
    raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  return query select p.versao_atual, p.status, p.preco_centavos, p.valido_ate
    from comercial.propostas p where p.id = p_proposta_id and p.deleted_at is null;
end;
$$;
revoke all on function comercial.sso_preco_orcamento_operacional(uuid) from public, anon, authenticated, service_role;

-- Origem sem oportunidade só usa snapshot público explícito, jamais texto interno.
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
    case when p.oportunidade_id is null then pub.payload_publico else comercial.projecao_proposta_publica(v.payload) end
    from comercial.proposta_origens_operacionais origem
    join comercial.propostas p on p.id = origem.proposta_id and p.deleted_at is null
    join pcm.listas_materiais l on l.id = origem.lista_materiais_id and l.cliente_id = p_cliente_id and l.ordem_servico_id = p_os_id
    left join comercial.oportunidades o on o.id = p.oportunidade_id and o.cliente_id = p_cliente_id and o.deleted_at is null
    join comercial.proposta_versoes v on v.proposta_id = p.id and v.versao = p.versao_atual
    left join comercial.sso_orcamento_publicacoes pub on pub.proposta_id = p.id and pub.versao = p.versao_atual
    where origem.ordem_servico_id = p_os_id
      and ((p.oportunidade_id is not null and o.id is not null) or
        (p.oportunidade_id is null and pub.proposta_id is not null and coalesce((select g.habilitado from comercial.sso_origem_operacional_gate g where g.id), false)))
      and p.status in ('enviada', 'aceita', 'recusada')
      and (p_apos is null or p.id > p_apos) order by p.id limit 20;
end;
$$;
revoke all on function comercial.sso_portal_propostas_os(uuid, uuid, uuid) from public, anon, authenticated, service_role;


