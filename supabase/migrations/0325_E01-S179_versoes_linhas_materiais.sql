-- ADR-0105: snapshots imutáveis; desabilitar RPCs como reversão operacional.
create table pcm.sso_lista_materiais_versoes (
  lista_id uuid not null references pcm.listas_materiais(id),
  revisao integer not null check (revisao > 1),
  linhas jsonb not null check (jsonb_typeof(linhas) = 'array'),
  criado_por uuid not null references config.usuarios(user_id),
  criado_em timestamptz not null default now(),
  primary key (lista_id, revisao)
);
alter table pcm.sso_lista_materiais_versoes enable row level security;
alter table pcm.sso_lista_materiais_versoes force row level security;
revoke all on pcm.sso_lista_materiais_versoes from public, anon, authenticated, service_role;

create function pcm.sso_salvar_linhas_materiais(
  p_request_id uuid, p_lista_id uuid, p_expected_revision integer, p_linhas jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ator uuid := auth.uid();
  v_lista pcm.listas_materiais%rowtype;
  v_comando pcm.sso_lista_materiais_comandos%rowtype;
  v_payload jsonb;
  v_linha jsonb;
  v_trecho jsonb;
  v_resultado jsonb;
begin
  if p_request_id is null or p_lista_id is null or p_expected_revision is null or p_expected_revision < 1
    or jsonb_typeof(p_linhas) is distinct from 'array' or octet_length(p_linhas::text) > 262144 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if jsonb_array_length(p_linhas) > 1000 then raise exception 'linhas_invalidas' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_lista from pcm.listas_materiais where id = p_lista_id for update;
  if not found then raise exception 'lista_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  perform 1 from pcm.ordens_servico o where o.id = v_lista.ordem_servico_id
    and o.client_id = v_lista.cliente_id and o.deleted_at is null for share;
  if not found or config.sso_autorizar_acao('material.gerir', v_lista.cliente_id) is not true then
    raise exception 'lista_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  v_payload := jsonb_build_object('operacao', 'salvar_linhas', 'listaId', p_lista_id,
    'expectedRevision', p_expected_revision, 'linhas', p_linhas);
  select * into v_comando from pcm.sso_lista_materiais_comandos where request_id = p_request_id;
  if found then
    if v_comando.ator_id is distinct from v_ator or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return v_comando.resultado;
  end if;
  if v_lista.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  for v_linha in select value from jsonb_array_elements(p_linhas) loop
    if jsonb_typeof(v_linha) is distinct from 'object'
      or (v_linha - 'descricao' - 'quantidade' - 'unidade' - 'trechosOriginais') <> '{}'::jsonb
      or jsonb_typeof(v_linha->'descricao') is distinct from 'string'
      or length(btrim(v_linha->>'descricao')) not between 1 and 4000
      or coalesce(jsonb_typeof(v_linha->'quantidade'), '') not in ('string','null')
      or coalesce(jsonb_typeof(v_linha->'unidade'), '') not in ('string','null')
      or jsonb_typeof(v_linha->'trechosOriginais') is distinct from 'array'
      or jsonb_array_length(v_linha->'trechosOriginais') not between 1 and 1000
      or (jsonb_typeof(v_linha->'quantidade') = 'string' and length(btrim(v_linha->>'quantidade')) not between 1 and 200)
      or (jsonb_typeof(v_linha->'unidade') = 'string' and length(btrim(v_linha->>'unidade')) not between 1 and 200) then
      raise exception 'linha_invalida' using errcode = '22023';
    end if;
    for v_trecho in select value from jsonb_array_elements(v_linha->'trechosOriginais') loop
      if jsonb_typeof(v_trecho) is distinct from 'string' or not exists (
        select 1 from pg_catalog.regexp_split_to_table(v_lista.texto_original, E'\r\n|\n|\r') as fonte(trecho)
        where fonte.trecho = v_trecho #>> '{}' and length(btrim(fonte.trecho)) > 0
      ) then raise exception 'evidencia_invalida' using errcode = '22023'; end if;
    end loop;
  end loop;
  update pcm.listas_materiais set revisao = revisao + 1 where id = p_lista_id returning * into v_lista;
  insert into pcm.sso_lista_materiais_versoes(lista_id, revisao, linhas, criado_por)
    values (p_lista_id, v_lista.revisao, p_linhas, v_ator);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_ator, 'material.linhas_organizadas', 'listas_materiais', p_lista_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_lista.cliente_id,
        'revision', v_lista.revisao, 'quantidadeLinhas', jsonb_array_length(p_linhas)));
  v_resultado := jsonb_build_object('aggregateId', p_lista_id, 'revision', v_lista.revisao,
    'state', v_lista.estado, 'created', false, 'linkedIds', '{}'::jsonb,
    'warnings', '[]'::jsonb, 'requestId', p_request_id);
  insert into pcm.sso_lista_materiais_comandos(request_id, ator_id, payload, resultado)
    values (p_request_id, v_ator, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_salvar_linhas_materiais(uuid, uuid, integer, jsonb) from public, anon, service_role;
grant execute on function pcm.sso_salvar_linhas_materiais(uuid, uuid, integer, jsonb) to authenticated;

create function pcm.sso_obter_linhas_materiais(p_lista_id uuid, p_revisao integer)
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
  if p_revisao = 1 then return null; end if;
  select linhas into v_linhas from pcm.sso_lista_materiais_versoes where lista_id = p_lista_id and revisao = p_revisao;
  if not found then raise exception 'revisao_nao_encontrada' using errcode = '23514'; end if;
  return v_linhas;
end;
$$;
revoke all on function pcm.sso_obter_linhas_materiais(uuid, integer) from public, anon, service_role;
grant execute on function pcm.sso_obter_linhas_materiais(uuid, integer) to authenticated;
