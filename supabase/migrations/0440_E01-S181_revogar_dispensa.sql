-- ADR-0214: histórico append-only, sem efeitos Financeiro.
alter table comercial.sso_dispensas_orcamento drop constraint sso_dispensas_orcamento_lista_id_key;
create index sso_dispensas_orcamento_lista_idx on comercial.sso_dispensas_orcamento(lista_id, criado_em desc, id);
create table comercial.sso_revogacoes_dispensa (
  id uuid primary key, dispensa_id uuid not null unique references comercial.sso_dispensas_orcamento(id),
  lista_revisao integer not null check (lista_revisao > 0), motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  ator_id uuid not null references config.usuarios(user_id), request_id uuid not null unique,
  criado_em timestamptz not null default now()
);
alter table comercial.sso_revogacoes_dispensa enable row level security;
alter table comercial.sso_revogacoes_dispensa force row level security;
revoke all on comercial.sso_revogacoes_dispensa from public, anon, authenticated, service_role;

create function comercial.sso_revogar_dispensa(p_request_id uuid, p_revogacao_id uuid, p_dispensa_id uuid,
  p_lista_revision integer, p_motivo text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_dispensa comercial.sso_dispensas_orcamento%rowtype; v_lista pcm.listas_materiais%rowtype;
  v_anterior comercial.sso_revogacoes_dispensa%rowtype;
begin
  if auth.uid() is null or p_request_id is null or p_revogacao_id is null or p_dispensa_id is null
    or p_lista_revision is null or p_lista_revision < 1 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('revogar-dispensa:' || p_request_id::text, 0));
  select * into v_dispensa from comercial.sso_dispensas_orcamento where id = p_dispensa_id;
  if not found then raise exception 'dispensa_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  select * into v_lista from pcm.listas_materiais where id = v_dispensa.lista_id for update;
  if not found or v_lista.cliente_id is distinct from v_dispensa.cliente_id
    or v_lista.ordem_servico_id is distinct from v_dispensa.ordem_servico_id
    or config.sso_autorizar_acao('orcamento.dispensar', v_lista.cliente_id) is not true
    or not exists (select 1 from pcm.ordens_servico os where os.id = v_lista.ordem_servico_id and os.client_id = v_lista.cliente_id and os.deleted_at is null) then
    raise exception 'dispensa_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  select * into v_anterior from comercial.sso_revogacoes_dispensa where request_id = p_request_id;
  if found then
    if v_anterior.ator_id is distinct from auth.uid() or v_anterior.id is distinct from p_revogacao_id
      or v_anterior.dispensa_id is distinct from p_dispensa_id or v_anterior.lista_revisao is distinct from p_lista_revision
      or v_anterior.motivo is distinct from btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return jsonb_build_object('aggregateId', v_anterior.id, 'revision', v_anterior.lista_revisao,
      'state', 'revogada', 'requestId', p_request_id, 'linkedIds', jsonb_build_object('dispensaId', p_dispensa_id, 'listaId', v_lista.id));
  end if;
  if not coalesce((select g.habilitado from comercial.sso_dispensa_orcamento_gate g where g.id), false) then
    raise exception 'dispensa_indisponivel' using errcode = '55000'; end if;
  if v_lista.revisao <> p_lista_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if exists (select 1 from comercial.sso_revogacoes_dispensa r where r.dispensa_id = p_dispensa_id) then
    raise exception 'dispensa_ja_revogada' using errcode = '23505'; end if;
  insert into comercial.sso_revogacoes_dispensa(id, dispensa_id, lista_revisao, motivo, ator_id, request_id)
    values (p_revogacao_id, p_dispensa_id, p_lista_revision, btrim(p_motivo), auth.uid(), p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'orcamento_operacional.dispensa_revogada', 'sso_dispensas_orcamento', p_dispensa_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_lista.cliente_id, 'listaId', v_lista.id,
        'listaRevision', p_lista_revision, 'revogacaoId', p_revogacao_id));
  return jsonb_build_object('aggregateId', p_revogacao_id, 'revision', p_lista_revision,
    'state', 'revogada', 'requestId', p_request_id, 'linkedIds', jsonb_build_object('dispensaId', p_dispensa_id, 'listaId', v_lista.id));
end;
$$;
revoke all on function comercial.sso_revogar_dispensa(uuid, uuid, uuid, integer, text) from public, anon, authenticated, service_role;

create function comercial.sso_historico_dispensa(p_lista_id uuid, p_apos uuid default null)
returns table(id uuid, tipo text, dispensa_id uuid, lista_revisao integer, motivo text, ator_id uuid, criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_cliente uuid;
begin
  select cliente_id into v_cliente from pcm.listas_materiais where pcm.listas_materiais.id = p_lista_id;
  if auth.uid() is null or v_cliente is null or (config.sso_autorizar_acao('orcamento.dispensar', v_cliente) is not true
    and config.sso_autorizar_acao('orcamento.emitir', v_cliente) is not true) then
    raise exception 'origem_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  if not coalesce((select g.habilitado from comercial.sso_dispensa_orcamento_gate g where g.id), false) then
    raise exception 'dispensa_indisponivel' using errcode = '55000'; end if;
  return query select h.id, h.tipo, h.dispensa_id, h.lista_revisao, h.motivo, h.ator_id, h.criado_em from (
    select d.id, 'dispensada'::text as tipo, d.id as dispensa_id, d.lista_revisao, d.motivo, d.ator_id, d.criado_em
      from comercial.sso_dispensas_orcamento d where d.lista_id = p_lista_id and d.cliente_id = v_cliente
    union all
    select r.id, 'revogada'::text, d.id, r.lista_revisao, r.motivo, r.ator_id, r.criado_em
      from comercial.sso_revogacoes_dispensa r join comercial.sso_dispensas_orcamento d on d.id = r.dispensa_id
      where d.lista_id = p_lista_id and d.cliente_id = v_cliente
  ) h where p_apos is null or h.id > p_apos order by h.id limit 20;
end;
$$;
revoke all on function comercial.sso_historico_dispensa(uuid, uuid) from public, anon, authenticated, service_role;

-- Novo registro somente após revogação; consulta retorna apenas dispensa vigente.
create or replace function comercial.sso_dispensar_orcamento(p_request_id uuid, p_dispensa_id uuid,
  p_lista_id uuid, p_lista_revision integer, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_lista pcm.listas_materiais%rowtype; v_anterior comercial.sso_dispensas_orcamento%rowtype; v_resultado jsonb;
begin
  if auth.uid() is null or p_request_id is null or p_dispensa_id is null or p_lista_id is null or p_lista_revision is null
    or p_lista_revision < 1 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('dispensa-orcamento:' || p_request_id::text, 0));
  select * into v_lista from pcm.listas_materiais where id = p_lista_id for update;
  if not found or config.sso_autorizar_acao('orcamento.dispensar', v_lista.cliente_id) is not true
    or not exists (select 1 from pcm.ordens_servico os where os.id = v_lista.ordem_servico_id
      and os.client_id = v_lista.cliente_id and os.deleted_at is null) then
    raise exception 'origem_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  select * into v_anterior from comercial.sso_dispensas_orcamento where request_id = p_request_id;
  if found then
    if v_anterior.ator_id is distinct from auth.uid() or v_anterior.id is distinct from p_dispensa_id
      or v_anterior.lista_id is distinct from p_lista_id or v_anterior.lista_revisao is distinct from p_lista_revision
      or v_anterior.motivo is distinct from btrim(p_motivo) then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return jsonb_build_object('aggregateId', v_anterior.id, 'revision', v_anterior.lista_revisao,
      'state', 'dispensado', 'requestId', p_request_id, 'linkedIds', jsonb_build_object('listaId', p_lista_id, 'ordemServicoId', v_anterior.ordem_servico_id));
  end if;
  if not coalesce((select g.habilitado from comercial.sso_dispensa_orcamento_gate g where g.id), false) then
    raise exception 'dispensa_indisponivel' using errcode = '55000'; end if;
  if v_lista.revisao <> p_lista_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if exists (select 1 from comercial.sso_dispensas_orcamento d where d.lista_id = p_lista_id
    and not exists (select 1 from comercial.sso_revogacoes_dispensa r where r.dispensa_id = d.id)) then
    raise exception 'dispensa_ja_registrada' using errcode = '23505'; end if;
  insert into comercial.sso_dispensas_orcamento(id, lista_id, lista_revisao, ordem_servico_id, cliente_id, motivo, ator_id, request_id)
    values (p_dispensa_id, p_lista_id, p_lista_revision, v_lista.ordem_servico_id, v_lista.cliente_id, btrim(p_motivo), auth.uid(), p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'orcamento_operacional.dispensado', 'sso_dispensas_orcamento', p_dispensa_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_lista.cliente_id, 'listaId', p_lista_id,
        'listaRevision', p_lista_revision, 'ordemServicoId', v_lista.ordem_servico_id));
  v_resultado := jsonb_build_object('aggregateId', p_dispensa_id, 'revision', p_lista_revision,
    'state', 'dispensado', 'requestId', p_request_id, 'linkedIds', jsonb_build_object('listaId', p_lista_id, 'ordemServicoId', v_lista.ordem_servico_id));
  return v_resultado;
end;
$$;
revoke all on function comercial.sso_dispensar_orcamento(uuid, uuid, uuid, integer, text) from public, anon, authenticated, service_role;

create or replace function comercial.sso_consultar_dispensa(p_lista_id uuid)
returns table(id uuid, lista_revisao integer, motivo text, ator_id uuid, criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_cliente uuid;
begin
  select cliente_id into v_cliente from pcm.listas_materiais where pcm.listas_materiais.id = p_lista_id;
  if auth.uid() is null or v_cliente is null or (config.sso_autorizar_acao('orcamento.dispensar', v_cliente) is not true
    and config.sso_autorizar_acao('orcamento.emitir', v_cliente) is not true) then
    raise exception 'origem_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  if not coalesce((select g.habilitado from comercial.sso_dispensa_orcamento_gate g where g.id), false) then
    raise exception 'dispensa_indisponivel' using errcode = '55000'; end if;
  return query select d.id, d.lista_revisao, d.motivo, d.ator_id, d.criado_em from comercial.sso_dispensas_orcamento d
    where d.lista_id = p_lista_id and d.cliente_id = v_cliente
      and not exists (select 1 from comercial.sso_revogacoes_dispensa r where r.dispensa_id = d.id);
end;
$$;
revoke all on function comercial.sso_consultar_dispensa(uuid) from public, anon, authenticated, service_role;

