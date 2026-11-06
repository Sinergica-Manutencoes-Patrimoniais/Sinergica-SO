-- ADR-0181: registra apenas conferência; nenhum efeito sobre lançamentos.
create table financeiro.sso_faturavel_conferencias_estorno (
  id uuid primary key, estorno_id uuid not null unique references financeiro.sso_faturavel_estornos(id),
  lancamento_saida_id uuid not null unique references financeiro.lancamentos(id),
  referencia text not null check (length(btrim(referencia)) between 1 and 200),
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  ator_id uuid not null references config.usuarios(user_id), request_id uuid not null unique,
  criado_em timestamptz not null default now()
);
alter table financeiro.sso_faturavel_conferencias_estorno enable row level security;
alter table financeiro.sso_faturavel_conferencias_estorno force row level security;
revoke all on financeiro.sso_faturavel_conferencias_estorno from public, anon, authenticated, service_role;

create function financeiro.sso_conferir_estorno_faturavel(p_request_id uuid, p_conferencia_id uuid,
  p_estorno_id uuid, p_saida_id uuid, p_referencia text, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_estorno financeiro.sso_faturavel_estornos%rowtype; v_item financeiro.itens_faturaveis%rowtype;
  v_saida financeiro.lancamentos%rowtype; v_comando financeiro.sso_faturavel_comandos%rowtype;
  v_payload jsonb; v_resultado jsonb;
begin
  if auth.uid() is null or p_request_id is null or p_conferencia_id is null or p_estorno_id is null or p_saida_id is null
    or p_referencia is null or length(btrim(p_referencia)) not between 1 and 200
    or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('faturavel:' || p_request_id::text, 0));
  lock table financeiro.fechamentos_mensais in share mode;
  select * into v_estorno from financeiro.sso_faturavel_estornos where id = p_estorno_id for share;
  if not found then raise exception 'estorno_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  select * into v_saida from financeiro.lancamentos where id = p_saida_id for update;
  select * into v_item from financeiro.itens_faturaveis where id = v_estorno.item_id for update;
  if not found or v_saida.id is null or v_saida.cliente_id is distinct from v_item.cliente_id
    or config.sso_autorizar_acao('faturavel.efetivar', v_item.cliente_id) is not true then
    raise exception 'estorno_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  v_payload := jsonb_build_object('operacao', 'conferir_estorno', 'conferenciaId', p_conferencia_id,
    'estornoId', p_estorno_id, 'saidaId', p_saida_id, 'referencia', btrim(p_referencia), 'motivo', btrim(p_motivo));
  select * into v_comando from financeiro.sso_faturavel_comandos where request_id = p_request_id;
  if found then
    if v_comando.ator_id is distinct from auth.uid() or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if not coalesce((select habilitado from financeiro.sso_faturamento_gate where id), false) then
    raise exception 'faturamento_indisponivel' using errcode = '55000'; end if;
  if v_saida.tipo <> 'saida' or v_saida.status <> 'realizado' or v_saida.valor_centavos <> v_estorno.valor_centavos then
    raise exception 'contrapartida_invalida' using errcode = '23514'; end if;
  if exists (select 1 from financeiro.fechamentos_mensais f where f.status = 'fechado'
    and f.competencia in (v_item.competencia, date_trunc('month', v_saida.data_competencia)::date)) then
    raise exception 'competencia_fechada' using errcode = '23514'; end if;
  insert into financeiro.sso_faturavel_conferencias_estorno(id, estorno_id, lancamento_saida_id, referencia, motivo, ator_id, request_id)
    values (p_conferencia_id, p_estorno_id, p_saida_id, btrim(p_referencia), btrim(p_motivo), auth.uid(), p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'faturavel.estorno_conferencia_declarada', 'itens_faturaveis', v_item.id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_item.cliente_id,
        'estornoId', p_estorno_id, 'conferenciaId', p_conferencia_id, 'saidaId', p_saida_id));
  v_resultado := jsonb_build_object('aggregateId', v_item.id, 'revision', v_item.revisao,
    'state', 'conferencia_declarada', 'requestId', p_request_id,
    'linkedIds', jsonb_build_object('estornoId', p_estorno_id, 'conferenciaId', p_conferencia_id, 'saidaId', p_saida_id));
  insert into financeiro.sso_faturavel_comandos(request_id, ator_id, payload, resultado)
    values (p_request_id, auth.uid(), v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function financeiro.sso_conferir_estorno_faturavel(uuid, uuid, uuid, uuid, text, text)
  from public, anon, authenticated, service_role;

create function financeiro.sso_estornos_para_conferencia(p_cliente_id uuid, p_apos uuid default null)
returns table(id uuid, item_id uuid, valor_centavos bigint, criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('faturavel.efetivar', p_cliente_id) is not true then
    raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  return query select e.id, e.item_id, e.valor_centavos, e.criado_em
    from financeiro.sso_faturavel_estornos e join financeiro.itens_faturaveis i on i.id = e.item_id
    where i.cliente_id = p_cliente_id and not exists (select 1 from financeiro.sso_faturavel_conferencias_estorno c where c.estorno_id = e.id)
      and (p_apos is null or e.id > p_apos) order by e.id limit 20;
end;
$$;
revoke all on function financeiro.sso_estornos_para_conferencia(uuid, uuid) from public, anon, authenticated, service_role;

create function financeiro.sso_saidas_para_conferencia(p_estorno_id uuid, p_apos uuid default null)
returns table(id uuid, descricao text, valor_centavos integer, competencia date, pagamento date)
language plpgsql stable security definer set search_path = '' as $$
declare v_cliente uuid; v_valor bigint;
begin
  select i.cliente_id, e.valor_centavos into v_cliente, v_valor from financeiro.sso_faturavel_estornos e
    join financeiro.itens_faturaveis i on i.id = e.item_id where e.id = p_estorno_id;
  if v_cliente is null or config.sso_autorizar_acao('faturavel.efetivar', v_cliente) is not true then
    raise exception 'estorno_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  return query select l.id, l.descricao, l.valor_centavos, l.data_competencia, l.data_pagamento
    from financeiro.lancamentos l where l.cliente_id = v_cliente and l.tipo = 'saida' and l.status = 'realizado'
      and l.valor_centavos = v_valor and not exists (select 1 from financeiro.sso_faturavel_conferencias_estorno c where c.lancamento_saida_id = l.id)
      and (p_apos is null or l.id > p_apos) order by l.id limit 20;
end;
$$;
revoke all on function financeiro.sso_saidas_para_conferencia(uuid, uuid) from public, anon, authenticated, service_role;
