-- ADR-0109: informação não confirma presença física; sem alteração de OS ou Auvo.
alter table pcm.listas_materiais drop constraint listas_materiais_estado_check;
alter table pcm.listas_materiais add constraint listas_materiais_estado_check
  check (estado in ('levantada', 'informada_disponivel', 'parcial', 'indisponivel'));
create table pcm.sso_lista_materiais_eventos (
  id uuid primary key default gen_random_uuid(),
  lista_id uuid not null references pcm.listas_materiais(id),
  revisao integer not null check (revisao > 1),
  tipo text not null check (tipo in ('disponibilidade', 'excecao')),
  dados jsonb not null,
  ator_id uuid not null references config.usuarios(user_id),
  criado_em timestamptz not null default now(),
  unique (lista_id, revisao)
);
alter table pcm.sso_lista_materiais_eventos enable row level security;
alter table pcm.sso_lista_materiais_eventos force row level security;
revoke all on pcm.sso_lista_materiais_eventos from public, anon, authenticated, service_role;

create function pcm.sso_informar_material(
  p_request_id uuid, p_lista_id uuid, p_expected_revision integer, p_tipo text, p_dados jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_lista pcm.listas_materiais%rowtype; v_ator uuid := auth.uid();
  v_comando pcm.sso_lista_materiais_comandos%rowtype; v_payload jsonb; v_resultado jsonb;
  v_estado text; v_linhas jsonb; v_revisao_linhas integer; v_posicao integer;
begin
  if p_request_id is null or p_lista_id is null or p_expected_revision is null or p_expected_revision < 1
    or p_tipo is null or p_tipo not in ('disponibilidade', 'excecao')
    or jsonb_typeof(p_dados) is distinct from 'object' or octet_length(p_dados::text) > 16384 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if p_tipo = 'disponibilidade' then
    if (p_dados - 'situacao') <> '{}'::jsonb or p_dados->>'situacao' is null
      or p_dados->>'situacao' not in ('informada_disponivel', 'parcial', 'indisponivel') then
      raise exception 'disponibilidade_invalida' using errcode = '22023';
    end if;
    v_estado := p_dados->>'situacao';
  else
    if (p_dados - 'motivo' - 'descricao' - 'revisaoLinhas' - 'posicao') <> '{}'::jsonb
      or p_dados->>'motivo' is null or p_dados->>'motivo' not in ('faltante', 'parcial', 'errado', 'novo_levantamento')
      or jsonb_typeof(p_dados->'descricao') is distinct from 'string'
      or length(btrim(p_dados->>'descricao')) not between 1 and 4000
      or (p_dados ? 'revisaoLinhas') <> (p_dados ? 'posicao') then
      raise exception 'excecao_invalida' using errcode = '22023';
    end if;
    if p_dados ? 'posicao' then
      if coalesce(p_dados->>'posicao','') !~ '^[0-9]{1,4}$'
        or coalesce(p_dados->>'revisaoLinhas','') !~ '^[0-9]{1,10}$' then
        raise exception 'linha_invalida' using errcode = '22023';
      end if;
      v_posicao := (p_dados->>'posicao')::integer;
      v_revisao_linhas := (p_dados->>'revisaoLinhas')::integer;
    end if;
    v_estado := 'levantada';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_lista from pcm.listas_materiais where id = p_lista_id for update;
  if not found then raise exception 'lista_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  perform 1 from pcm.ordens_servico o where o.id = v_lista.ordem_servico_id
    and o.client_id = v_lista.cliente_id and o.deleted_at is null for share;
  if not found or config.sso_autorizar_acao('material.gerir', v_lista.cliente_id) is not true then
    raise exception 'lista_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  v_payload := jsonb_build_object('operacao', p_tipo, 'listaId', p_lista_id,
    'expectedRevision', p_expected_revision, 'dados', p_dados);
  select * into v_comando from pcm.sso_lista_materiais_comandos where request_id = p_request_id;
  if found then
    if v_comando.ator_id is distinct from v_ator or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return v_comando.resultado;
  end if;
  if v_lista.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if v_posicao is not null then
    if v_revisao_linhas < 2 or v_revisao_linhas > v_lista.revisao then raise exception 'linha_invalida' using errcode = '22023'; end if;
    select linhas into v_linhas from pcm.sso_lista_materiais_versoes where lista_id = p_lista_id and revisao = v_revisao_linhas;
    if not found or v_posicao < 0 or v_posicao >= jsonb_array_length(v_linhas) then raise exception 'linha_invalida' using errcode = '22023'; end if;
  end if;
  update pcm.listas_materiais set revisao = revisao + 1, estado = v_estado where id = p_lista_id returning * into v_lista;
  insert into pcm.sso_lista_materiais_eventos(lista_id, revisao, tipo, dados, ator_id)
    values (p_lista_id, v_lista.revisao, p_tipo, p_dados, v_ator);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_ator, 'material.' || p_tipo, 'listas_materiais', p_lista_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_lista.cliente_id, 'revision', v_lista.revisao));
  v_resultado := jsonb_build_object('aggregateId', p_lista_id, 'revision', v_lista.revisao,
    'state', v_lista.estado, 'created', false, 'linkedIds', '{}'::jsonb,
    'warnings', '[]'::jsonb, 'requestId', p_request_id);
  insert into pcm.sso_lista_materiais_comandos(request_id, ator_id, payload, resultado)
    values (p_request_id, v_ator, v_payload, v_resultado);
  return v_resultado;
end;
$$;

create function pcm.sso_listar_eventos_materiais(p_lista_id uuid, p_limite integer, p_apos integer default 0)
returns table(revisao integer, tipo text, dados jsonb, ator_id uuid, criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_lista pcm.listas_materiais%rowtype;
begin
  if p_limite is null or p_limite not between 1 and 100 or p_apos is null or p_apos < 0 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  select * into v_lista from pcm.listas_materiais where id = p_lista_id;
  if not found or config.sso_autorizar_acao('material.gerir', v_lista.cliente_id) is not true
    or not exists(select 1 from pcm.ordens_servico o where o.id = v_lista.ordem_servico_id
      and o.client_id = v_lista.cliente_id and o.deleted_at is null) then
    raise exception 'lista_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  return query select e.revisao, e.tipo, e.dados, e.ator_id, e.criado_em
    from pcm.sso_lista_materiais_eventos e where e.lista_id = p_lista_id and e.revisao > p_apos
    order by e.revisao limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_eventos_materiais(uuid, integer, integer) from public, anon, service_role;
grant execute on function pcm.sso_listar_eventos_materiais(uuid, integer, integer) to authenticated;
revoke all on function pcm.sso_informar_material(uuid, uuid, integer, text, jsonb) from public, anon, service_role;
grant execute on function pcm.sso_informar_material(uuid, uuid, integer, text, jsonb) to authenticated;

create or replace function pcm.sso_obter_linhas_materiais(p_lista_id uuid, p_revisao integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_lista pcm.listas_materiais%rowtype; v_linhas jsonb;
begin
  select * into v_lista from pcm.listas_materiais where id = p_lista_id;
  if not found or config.sso_autorizar_acao('material.gerir', v_lista.cliente_id) is not true
    or not exists(select 1 from pcm.ordens_servico o where o.id = v_lista.ordem_servico_id
      and o.client_id = v_lista.cliente_id and o.deleted_at is null) then
    raise exception 'lista_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  if p_revisao is null or p_revisao < 1 or p_revisao > v_lista.revisao then
    raise exception 'revisao_invalida' using errcode = '22023';
  end if;
  select linhas into v_linhas from pcm.sso_lista_materiais_versoes
    where lista_id = p_lista_id and revisao <= p_revisao order by revisao desc limit 1;
  return v_linhas;
end;
$$;
