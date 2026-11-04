-- ADR-0148: projeção explicitamente publicada; comandos revogados até revisão.
create table pcm.sso_portal_materiais_publicacoes (
  lista_id uuid not null references pcm.listas_materiais(id),
  revisao_lista integer not null check (revisao_lista > 0),
  linhas jsonb not null check (jsonb_typeof(linhas) = 'array'),
  publicado_por uuid not null references config.usuarios(user_id),
  publicado_em timestamptz not null default now(),
  primary key (lista_id, revisao_lista)
);
create table pcm.sso_portal_materiais_comandos (
  request_id uuid primary key, ator_id uuid not null references config.usuarios(user_id),
  payload jsonb not null, resultado jsonb not null, criado_em timestamptz not null default now()
);
alter table pcm.sso_portal_materiais_publicacoes enable row level security;
alter table pcm.sso_portal_materiais_publicacoes force row level security;
alter table pcm.sso_portal_materiais_comandos enable row level security;
alter table pcm.sso_portal_materiais_comandos force row level security;
revoke all on pcm.sso_portal_materiais_publicacoes, pcm.sso_portal_materiais_comandos
  from public, anon, authenticated, service_role;

create function pcm.sso_portal_publicar_materiais(p_request_id uuid, p_lista_id uuid,
  p_expected_revision integer, p_linhas jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_lista pcm.listas_materiais%rowtype; v_comando pcm.sso_portal_materiais_comandos%rowtype;
  v_payload jsonb; v_resultado jsonb; v_linha jsonb;
begin
  if auth.uid() is null or p_request_id is null or p_lista_id is null or p_expected_revision is null
    or p_expected_revision < 1 or jsonb_typeof(p_linhas) is distinct from 'array'
    or jsonb_array_length(p_linhas) > 100 or octet_length(p_linhas::text) > 65536 then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  for v_linha in select value from jsonb_array_elements(p_linhas) loop
    if jsonb_typeof(v_linha) is distinct from 'object'
      or (v_linha - 'descricao' - 'quantidade' - 'unidade') <> '{}'::jsonb
      or jsonb_typeof(v_linha->'descricao') is distinct from 'string'
      or length(btrim(v_linha->>'descricao')) not between 1 and 1000
      or coalesce(jsonb_typeof(v_linha->'quantidade'), '') not in ('string', 'null')
      or coalesce(jsonb_typeof(v_linha->'unidade'), '') not in ('string', 'null')
      or length(coalesce(v_linha->>'quantidade', '')) > 100
      or length(coalesce(v_linha->>'unidade', '')) > 100 then
      raise exception 'linha_invalida' using errcode = '22023'; end if;
  end loop;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('portal-material:' || p_request_id::text, 0));
  select * into v_lista from pcm.listas_materiais where id = p_lista_id for update;
  if not found or config.sso_autorizar_acao('material.gerir', v_lista.cliente_id) is not true
    or not exists (select 1 from pcm.ordens_servico o where o.id = v_lista.ordem_servico_id
      and o.client_id = v_lista.cliente_id and o.deleted_at is null) then
    raise exception 'lista_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  v_payload := jsonb_build_object('operacao', 'publicar', 'listaId', p_lista_id,
    'expectedRevision', p_expected_revision, 'linhas', p_linhas);
  select * into v_comando from pcm.sso_portal_materiais_comandos where request_id = p_request_id;
  if found then
    if v_comando.ator_id is distinct from auth.uid() or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if v_lista.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  insert into pcm.sso_portal_materiais_publicacoes(lista_id, revisao_lista, linhas, publicado_por)
    values (p_lista_id, p_expected_revision, p_linhas, auth.uid());
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'material.publicado_portal', 'listas_materiais', p_lista_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_lista.cliente_id, 'revision', v_lista.revisao));
  v_resultado := jsonb_build_object('aggregateId', p_lista_id, 'revision', v_lista.revisao,
    'state', v_lista.estado, 'requestId', p_request_id);
  insert into pcm.sso_portal_materiais_comandos(request_id, ator_id, payload, resultado)
    values (p_request_id, auth.uid(), v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_portal_publicar_materiais(uuid, uuid, integer, jsonb)
  from public, anon, authenticated, service_role;

create function pcm.sso_portal_listar_materiais(p_cliente_id uuid, p_os_id uuid, p_apos uuid default null)
returns table(id uuid, ordem_servico_id uuid, responsavel text, estado text, revisao integer,
  linhas jsonb, publicado_em timestamptz, ultima_informacao_em timestamptz, ultima_informacao_por uuid,
  excecao_atual boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_os_id is null or not exists (
    select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id = uc.user_id
    where uc.user_id = auth.uid() and uc.cliente_id = p_cliente_id and u.ativo and u.papel = 'cliente-sindico'
  ) or not exists (select 1 from pcm.ordens_servico o where o.id = p_os_id
    and o.client_id = p_cliente_id and o.deleted_at is null) then
    raise exception 'ordem_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  return query select l.id, l.ordem_servico_id, l.responsavel, l.estado, l.revisao,
    p.linhas, p.publicado_em, ev.criado_em, ev.ator_id, coalesce(ex.tipo = 'excecao', false)
    from pcm.listas_materiais l join lateral (select pub.* from pcm.sso_portal_materiais_publicacoes pub
      where pub.lista_id = l.id and pub.revisao_lista >= coalesce((select max(v.revisao)
        from pcm.sso_lista_materiais_versoes v where v.lista_id = l.id), 1)
      order by pub.revisao_lista desc limit 1) p on true
    left join lateral (select e.criado_em, e.ator_id from pcm.sso_lista_materiais_eventos e
      where e.lista_id = l.id and e.tipo = 'disponibilidade' order by e.revisao desc limit 1) ev on true
    left join lateral (select e.tipo from pcm.sso_lista_materiais_eventos e
      where e.lista_id = l.id order by e.revisao desc limit 1) ex on true
    where l.cliente_id = p_cliente_id and l.ordem_servico_id = p_os_id and (p_apos is null or l.id > p_apos)
    order by l.id limit 20;
end;
$$;
revoke all on function pcm.sso_portal_listar_materiais(uuid, uuid, uuid) from public, anon, authenticated, service_role;

create function pcm.sso_portal_informar_material(p_request_id uuid, p_lista_id uuid,
  p_expected_revision integer, p_situacao text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_lista pcm.listas_materiais%rowtype; v_comando pcm.sso_portal_materiais_comandos%rowtype;
  v_payload jsonb; v_resultado jsonb;
begin
  if auth.uid() is null or p_request_id is null or p_lista_id is null or p_expected_revision is null
    or p_expected_revision < 1 or p_situacao is null
    or p_situacao not in ('informada_disponivel', 'parcial', 'indisponivel') then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('portal-material:' || p_request_id::text, 0));
  select * into v_lista from pcm.listas_materiais where id = p_lista_id for update;
  if not found or v_lista.responsavel <> 'cliente' or not exists (
    select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id = uc.user_id
    where uc.user_id = auth.uid() and uc.cliente_id = v_lista.cliente_id and u.ativo and u.papel = 'cliente-sindico'
  ) or not exists (select 1 from pcm.sso_portal_materiais_publicacoes p where p.lista_id = p_lista_id
    and p.revisao_lista >= coalesce((select max(v.revisao) from pcm.sso_lista_materiais_versoes v
      where v.lista_id = p_lista_id), 1))
    or not exists (select 1 from pcm.ordens_servico o where o.id = v_lista.ordem_servico_id
      and o.client_id = v_lista.cliente_id and o.deleted_at is null) then
    raise exception 'lista_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  v_payload := jsonb_build_object('operacao', 'informar', 'listaId', p_lista_id,
    'expectedRevision', p_expected_revision, 'situacao', p_situacao);
  select * into v_comando from pcm.sso_portal_materiais_comandos where request_id = p_request_id;
  if found then
    if v_comando.ator_id is distinct from auth.uid() or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if v_lista.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  update pcm.listas_materiais set estado = p_situacao, revisao = revisao + 1
    where id = p_lista_id returning * into v_lista;
  insert into pcm.sso_lista_materiais_eventos(lista_id, revisao, tipo, dados, ator_id)
    values (p_lista_id, v_lista.revisao, 'disponibilidade', jsonb_build_object('situacao', p_situacao), auth.uid());
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'material.disponibilidade_portal', 'listas_materiais', p_lista_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_lista.cliente_id, 'revision', v_lista.revisao));
  v_resultado := jsonb_build_object('aggregateId', p_lista_id, 'revision', v_lista.revisao,
    'state', v_lista.estado, 'requestId', p_request_id);
  insert into pcm.sso_portal_materiais_comandos(request_id, ator_id, payload, resultado)
    values (p_request_id, auth.uid(), v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_portal_informar_material(uuid, uuid, integer, text)
  from public, anon, authenticated, service_role;
