-- ADR-0099: fundação de lista textual. Não habilita linhas, disponibilidade ou Auvo.
-- Reversão operacional: revogar EXECUTE das RPCs; preservar dados e auditoria.
create unique index if not exists sso_ordens_servico_id_cliente_uq on pcm.ordens_servico (id, client_id);

create table pcm.listas_materiais (
  id uuid primary key,
  cliente_id uuid not null references pcm.clientes(id),
  ordem_servico_id uuid not null,
  responsavel text not null check (responsavel in ('cliente', 'sinergica')),
  texto_original text not null check (length(btrim(texto_original)) > 0 and octet_length(texto_original) <= 65536),
  estado text not null default 'levantada' check (estado = 'levantada'),
  revisao integer not null default 1 check (revisao > 0),
  criado_por uuid not null references config.usuarios(user_id),
  criado_em timestamptz not null default now(),
  foreign key (ordem_servico_id, cliente_id) references pcm.ordens_servico(id, client_id)
);
create table pcm.sso_lista_materiais_comandos (
  request_id uuid primary key,
  ator_id uuid not null references config.usuarios(user_id),
  payload jsonb not null,
  resultado jsonb not null,
  criado_em timestamptz not null default now()
);
alter table pcm.listas_materiais enable row level security;
alter table pcm.listas_materiais force row level security;
alter table pcm.sso_lista_materiais_comandos enable row level security;
alter table pcm.sso_lista_materiais_comandos force row level security;
revoke all on pcm.listas_materiais, pcm.sso_lista_materiais_comandos from public, anon, authenticated, service_role;

create function pcm.sso_registrar_lista_materiais(
  p_request_id uuid, p_expected_revision integer, p_lista_id uuid, p_ordem_servico_id uuid,
  p_responsavel text, p_texto_original text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ator uuid := auth.uid();
  v_cliente uuid;
  v_payload jsonb;
  v_comando pcm.sso_lista_materiais_comandos%rowtype;
  v_resultado jsonb;
begin
  if p_request_id is null or p_expected_revision is distinct from 0 or p_lista_id is null
    or p_ordem_servico_id is null or p_responsavel is null
    or p_responsavel not in ('cliente', 'sinergica') or p_texto_original is null
    or length(btrim(p_texto_original)) = 0 or octet_length(p_texto_original) > 65536 then
    raise exception 'lista_invalida' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select o.client_id into v_cliente from pcm.ordens_servico o
    where o.id = p_ordem_servico_id and o.deleted_at is null for share;
  if v_cliente is null or config.sso_autorizar_acao('material.gerir', v_cliente) is not true then
    raise exception 'ordem_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  v_payload := jsonb_build_object('listaId', p_lista_id, 'ordemServicoId', p_ordem_servico_id,
    'responsavel', p_responsavel, 'textoOriginal', p_texto_original, 'expectedRevision', p_expected_revision);
  select * into v_comando from pcm.sso_lista_materiais_comandos where request_id = p_request_id;
  if found then
    if v_comando.ator_id is distinct from v_ator or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return v_comando.resultado;
  end if;
  insert into pcm.listas_materiais(id, cliente_id, ordem_servico_id, responsavel, texto_original, criado_por)
    values (p_lista_id, v_cliente, p_ordem_servico_id, p_responsavel, p_texto_original, v_ator);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_ator, 'material.lista_criada', 'listas_materiais', p_lista_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_cliente, 'revision', 1));
  v_resultado := jsonb_build_object('aggregateId', p_lista_id, 'revision', 1, 'state', 'levantada',
    'created', true, 'linkedIds', jsonb_build_object('ordemServicoId', p_ordem_servico_id),
    'warnings', '[]'::jsonb, 'requestId', p_request_id);
  insert into pcm.sso_lista_materiais_comandos(request_id, ator_id, payload, resultado)
    values (p_request_id, v_ator, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_registrar_lista_materiais(uuid, integer, uuid, uuid, text, text) from public, anon, service_role;
grant execute on function pcm.sso_registrar_lista_materiais(uuid, integer, uuid, uuid, text, text) to authenticated;

create function pcm.sso_listar_listas_materiais(
  p_cliente_id uuid, p_ordem_servico_id uuid, p_limite integer, p_apos uuid default null
) returns table(id uuid, ordem_servico_id uuid, responsavel text, texto_original text, estado text, revisao integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_cliente_id is null or p_ordem_servico_id is null or p_limite is null or p_limite not between 1 and 100 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if config.sso_autorizar_acao('material.gerir', p_cliente_id) is not true
    or not exists(select 1 from pcm.ordens_servico o where o.id = p_ordem_servico_id
      and o.client_id = p_cliente_id and o.deleted_at is null) then
    raise exception 'ordem_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  return query select l.id, l.ordem_servico_id, l.responsavel, l.texto_original, l.estado, l.revisao
    from pcm.listas_materiais l where l.cliente_id = p_cliente_id and l.ordem_servico_id = p_ordem_servico_id
      and (p_apos is null or l.id > p_apos) order by l.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_listas_materiais(uuid, uuid, integer, uuid) from public, anon, service_role;
grant execute on function pcm.sso_listar_listas_materiais(uuid, uuid, integer, uuid) to authenticated;
