-- ADR-0239: nenhuma mudança nas políticas Storage legadas nesta preparação.
insert into config.sso_acoes(codigo, modulo, nivel, exige_concessao_individual)
  values ('anexo_os.publicar', 'pcm', 'escrita', true) on conflict (codigo) do nothing;
create table pcm.sso_portal_anexo_gate (id boolean primary key default true check (id), habilitado boolean not null default false);
alter table pcm.sso_portal_anexo_gate enable row level security;
alter table pcm.sso_portal_anexo_gate force row level security;
revoke all on pcm.sso_portal_anexo_gate from public, anon, authenticated, service_role;
insert into pcm.sso_portal_anexo_gate(id, habilitado) values (true, false);
create table pcm.sso_portal_anexos_publicacoes (
  id uuid primary key, nota_id uuid not null references pcm.os_notas(id), cliente_id uuid not null references pcm.clientes(id),
  ordem_servico_id uuid not null references pcm.ordens_servico(id), objeto_id uuid not null,
  caminho text not null, metadata_snapshot jsonb, objeto_updated_at timestamptz,
  titulo text not null check (length(btrim(titulo)) between 1 and 300),
  ator_id uuid not null references config.usuarios(user_id), request_id uuid not null unique, criado_em timestamptz not null default now()
);
create table pcm.sso_portal_anexos_revogacoes (
  id uuid primary key, publicacao_id uuid not null unique references pcm.sso_portal_anexos_publicacoes(id),
  motivo text not null check (length(btrim(motivo)) between 1 and 2000), ator_id uuid not null references config.usuarios(user_id),
  request_id uuid not null unique, criado_em timestamptz not null default now()
);
alter table pcm.sso_portal_anexos_publicacoes enable row level security;
alter table pcm.sso_portal_anexos_publicacoes force row level security;
alter table pcm.sso_portal_anexos_revogacoes enable row level security;
alter table pcm.sso_portal_anexos_revogacoes force row level security;
revoke all on pcm.sso_portal_anexos_publicacoes, pcm.sso_portal_anexos_revogacoes from public, anon, authenticated, service_role;

create function pcm.sso_publicar_anexo_os(p_request_id uuid, p_publicacao_id uuid, p_nota_id uuid, p_titulo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_nota pcm.os_notas%rowtype; v_objeto storage.objects%rowtype; v_anterior pcm.sso_portal_anexos_publicacoes%rowtype;
begin
  if auth.uid() is null or p_request_id is null or p_publicacao_id is null or p_nota_id is null
    or p_titulo is null or length(btrim(p_titulo)) not between 1 and 300 then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('publicar-anexo:' || p_request_id::text, 0));
  select * into v_nota from pcm.os_notas where id = p_nota_id for share;
  if not found or v_nota.anexo_path is null or config.sso_autorizar_acao('anexo_os.publicar', v_nota.cliente_id) is not true
    or not exists (select 1 from pcm.ordens_servico os where os.id = v_nota.ordem_servico_id and os.client_id = v_nota.cliente_id and os.deleted_at is null) then
    raise exception 'anexo_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  select * into v_anterior from pcm.sso_portal_anexos_publicacoes where request_id = p_request_id;
  if found then
    if v_anterior.ator_id is distinct from auth.uid() or v_anterior.id is distinct from p_publicacao_id
      or v_anterior.nota_id is distinct from p_nota_id or v_anterior.titulo is distinct from btrim(p_titulo) then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return jsonb_build_object('aggregateId', v_anterior.id, 'state', 'publicado', 'requestId', p_request_id,
      'linkedIds', jsonb_build_object('ordemServicoId', v_anterior.ordem_servico_id));
  end if;
  if not coalesce((select habilitado from pcm.sso_portal_anexo_gate where id), false) then raise exception 'publicacao_indisponivel' using errcode = '55000'; end if;
  select o.* into v_objeto from storage.objects o join storage.buckets b on b.id = o.bucket_id and b.public is false
    where o.bucket_id = 'os-anexos' and o.name = v_nota.anexo_path and split_part(o.name, '/', 1) = v_nota.cliente_id::text for share of o;
  if not found then raise exception 'objeto_indisponivel' using errcode = '23514'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('anexo-nota:' || p_nota_id::text, 0));
  if exists (select 1 from pcm.sso_portal_anexos_publicacoes p where p.nota_id = p_nota_id
    and not exists (select 1 from pcm.sso_portal_anexos_revogacoes r where r.publicacao_id = p.id)) then
    raise exception 'publicacao_ativa_existente' using errcode = '23505'; end if;
  insert into pcm.sso_portal_anexos_publicacoes(id, nota_id, cliente_id, ordem_servico_id, objeto_id, caminho,
    metadata_snapshot, objeto_updated_at, titulo, ator_id, request_id)
    values (p_publicacao_id, p_nota_id, v_nota.cliente_id, v_nota.ordem_servico_id, v_objeto.id, v_objeto.name,
      v_objeto.metadata, v_objeto.updated_at, btrim(p_titulo), auth.uid(), p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'anexo_os.publicado', 'sso_portal_anexos_publicacoes', p_publicacao_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_nota.cliente_id, 'ordemServicoId', v_nota.ordem_servico_id));
  return jsonb_build_object('aggregateId', p_publicacao_id, 'state', 'publicado', 'requestId', p_request_id,
    'linkedIds', jsonb_build_object('ordemServicoId', v_nota.ordem_servico_id));
end;
$$;
revoke all on function pcm.sso_publicar_anexo_os(uuid, uuid, uuid, text) from public, anon, authenticated, service_role;

create function pcm.sso_anexos_os_para_publicacao(p_cliente_id uuid, p_os_id uuid, p_apos uuid default null)
returns table(nota_id uuid, criado_em timestamptz, publicacao_id uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_os_id is null
    or config.sso_autorizar_acao('anexo_os.publicar', p_cliente_id) is not true
    or not exists (select 1 from pcm.ordens_servico os where os.id = p_os_id and os.client_id = p_cliente_id and os.deleted_at is null) then
    raise exception 'ordem_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  if not coalesce((select habilitado from pcm.sso_portal_anexo_gate where id), false) then raise exception 'publicacao_indisponivel' using errcode = '55000'; end if;
  return query select n.id, n.created_at, pub.id
    from pcm.os_notas n join storage.objects o on o.name = n.anexo_path and o.bucket_id = 'os-anexos'
    join storage.buckets b on b.id = o.bucket_id and b.public is false
    left join lateral (select p.id from pcm.sso_portal_anexos_publicacoes p where p.nota_id = n.id
      and not exists (select 1 from pcm.sso_portal_anexos_revogacoes r where r.publicacao_id = p.id)
      order by p.criado_em desc, p.id desc limit 1) pub on true
    where n.cliente_id = p_cliente_id and n.ordem_servico_id = p_os_id and split_part(o.name, '/', 1) = p_cliente_id::text
      and (p_apos is null or n.id > p_apos) order by n.id limit 20;
end;
$$;
revoke all on function pcm.sso_anexos_os_para_publicacao(uuid, uuid, uuid) from public, anon, authenticated, service_role;

create function pcm.sso_anexo_os_revisao_autorizado(p_nota_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_caminho text;
begin
  if auth.uid() is null or p_nota_id is null or not coalesce((select habilitado from pcm.sso_portal_anexo_gate where id), false) then
    raise exception 'anexo_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  select n.anexo_path into v_caminho from pcm.os_notas n
    join pcm.ordens_servico os on os.id = n.ordem_servico_id and os.client_id = n.cliente_id and os.deleted_at is null
    join storage.objects o on o.name = n.anexo_path and o.bucket_id = 'os-anexos' and split_part(o.name, '/', 1) = n.cliente_id::text
    join storage.buckets b on b.id = o.bucket_id and b.public is false
    where n.id = p_nota_id and config.sso_autorizar_acao('anexo_os.publicar', n.cliente_id) is true;
  if v_caminho is null then raise exception 'anexo_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  return v_caminho;
end;
$$;
revoke all on function pcm.sso_anexo_os_revisao_autorizado(uuid) from public, anon, authenticated, service_role;

create function pcm.sso_revogar_anexo_os(p_request_id uuid, p_revogacao_id uuid, p_publicacao_id uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_publicacao pcm.sso_portal_anexos_publicacoes%rowtype; v_anterior pcm.sso_portal_anexos_revogacoes%rowtype;
begin
  if auth.uid() is null or p_request_id is null or p_revogacao_id is null or p_publicacao_id is null
    or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('revogar-anexo:' || p_request_id::text, 0));
  select * into v_publicacao from pcm.sso_portal_anexos_publicacoes where id = p_publicacao_id for share;
  if not found or config.sso_autorizar_acao('anexo_os.publicar', v_publicacao.cliente_id) is not true then
    raise exception 'anexo_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  select * into v_anterior from pcm.sso_portal_anexos_revogacoes where request_id = p_request_id;
  if found then
    if v_anterior.ator_id is distinct from auth.uid() or v_anterior.id is distinct from p_revogacao_id
      or v_anterior.publicacao_id is distinct from p_publicacao_id or v_anterior.motivo is distinct from btrim(p_motivo) then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return jsonb_build_object('aggregateId', v_anterior.id, 'state', 'revogado', 'requestId', p_request_id,
      'linkedIds', jsonb_build_object('publicacaoId', p_publicacao_id));
  end if;
  if not coalesce((select habilitado from pcm.sso_portal_anexo_gate where id), false) then raise exception 'publicacao_indisponivel' using errcode = '55000'; end if;
  insert into pcm.sso_portal_anexos_revogacoes(id, publicacao_id, motivo, ator_id, request_id)
    values (p_revogacao_id, p_publicacao_id, btrim(p_motivo), auth.uid(), p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'anexo_os.revogado', 'sso_portal_anexos_publicacoes', p_publicacao_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_publicacao.cliente_id, 'revogacaoId', p_revogacao_id));
  return jsonb_build_object('aggregateId', p_revogacao_id, 'state', 'revogado', 'requestId', p_request_id,
    'linkedIds', jsonb_build_object('publicacaoId', p_publicacao_id));
end;
$$;
revoke all on function pcm.sso_revogar_anexo_os(uuid, uuid, uuid, text) from public, anon, authenticated, service_role;

create function pcm.sso_portal_listar_anexos_os(p_cliente_id uuid, p_os_id uuid, p_apos uuid default null)
returns table(id uuid, titulo text, publicado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_os_id is null
    or not exists (select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id = uc.user_id
      where uc.user_id = auth.uid() and uc.cliente_id = p_cliente_id and u.ativo and u.papel = 'cliente-sindico')
    or not exists (select 1 from pcm.ordens_servico os where os.id = p_os_id and os.client_id = p_cliente_id and os.deleted_at is null) then
    raise exception 'ordem_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  if not coalesce((select habilitado from pcm.sso_portal_anexo_gate where id), false) then raise exception 'publicacao_indisponivel' using errcode = '55000'; end if;
  return query select p.id, p.titulo, p.criado_em from pcm.sso_portal_anexos_publicacoes p
    join storage.objects o on o.id = p.objeto_id and o.bucket_id = 'os-anexos' and o.name = p.caminho
      and o.metadata is not distinct from p.metadata_snapshot and o.updated_at is not distinct from p.objeto_updated_at
    join storage.buckets b on b.id = o.bucket_id and b.public is false
    where p.cliente_id = p_cliente_id and p.ordem_servico_id = p_os_id
      and not exists (select 1 from pcm.sso_portal_anexos_revogacoes r where r.publicacao_id = p.id)
      and (p_apos is null or p.id > p_apos) order by p.id limit 20;
end;
$$;
revoke all on function pcm.sso_portal_listar_anexos_os(uuid, uuid, uuid) from public, anon, authenticated, service_role;

create function pcm.sso_portal_anexo_os_autorizado(p_publicacao_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_caminho text;
begin
  if auth.uid() is null or p_publicacao_id is null or not coalesce((select habilitado from pcm.sso_portal_anexo_gate where id), false) then
    raise exception 'anexo_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  select p.caminho into v_caminho from pcm.sso_portal_anexos_publicacoes p
    join pcm.ordens_servico os on os.id = p.ordem_servico_id and os.client_id = p.cliente_id and os.deleted_at is null
    join pcm.os_notas n on n.id = p.nota_id and n.cliente_id = p.cliente_id and n.ordem_servico_id = p.ordem_servico_id and n.anexo_path = p.caminho
    join storage.objects o on o.id = p.objeto_id and o.bucket_id = 'os-anexos' and o.name = p.caminho
      and o.metadata is not distinct from p.metadata_snapshot and o.updated_at is not distinct from p.objeto_updated_at
    join storage.buckets b on b.id = o.bucket_id and b.public is false
    where p.id = p_publicacao_id and not exists (select 1 from pcm.sso_portal_anexos_revogacoes r where r.publicacao_id = p.id)
      and exists (select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id = uc.user_id
        where uc.user_id = auth.uid() and uc.cliente_id = p.cliente_id and u.ativo and u.papel = 'cliente-sindico');
  if v_caminho is null then raise exception 'anexo_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  return v_caminho;
end;
$$;
revoke all on function pcm.sso_portal_anexo_os_autorizado(uuid) from public, anon, authenticated, service_role;
