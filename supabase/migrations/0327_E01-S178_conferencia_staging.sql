-- ADR-0108. Anotações em staging somente; não aprova nem altera estrutura oficial.
create table pcm.sso_levantamento_conferencias (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null,
  chave_linha text not null,
  revisao_lote integer not null check (revisao_lote > 1),
  observacao text not null check (length(btrim(observacao)) between 1 and 2000),
  ator_id uuid not null references config.usuarios(user_id),
  criado_em timestamptz not null default now(),
  foreign key (lote_id, chave_linha) references pcm.sso_levantamento_linhas(lote_id, chave),
  unique (lote_id, revisao_lote)
);
create index idx_conferencia_levantamento_linha on pcm.sso_levantamento_conferencias(lote_id, chave_linha, revisao_lote);
alter table pcm.sso_levantamento_conferencias enable row level security;
alter table pcm.sso_levantamento_conferencias force row level security;
revoke all on pcm.sso_levantamento_conferencias from public, anon, authenticated, service_role;
create function pcm.sso_proteger_conferencia_levantamento() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'conferencia_imutavel' using errcode = '23514';
end;
$$;
revoke all on function pcm.sso_proteger_conferencia_levantamento() from public, anon, authenticated, service_role;
create trigger sso_conferencia_imutavel before update or delete on pcm.sso_levantamento_conferencias
for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_anotar_conferencia_levantamento(
  p_request_id uuid, p_lote_id uuid, p_chave_linha text, p_expected_revision integer, p_observacao text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ator uuid := auth.uid();
  v_lote pcm.sso_levantamentos%rowtype;
  v_comando pcm.sso_levantamento_comandos%rowtype;
  v_payload jsonb; v_resultado jsonb; v_id uuid;
begin
  if v_ator is null or p_request_id is null or p_lote_id is null or p_chave_linha is null
    or length(btrim(p_chave_linha)) not between 1 and 200 or p_expected_revision is null or p_expected_revision < 1
    or p_observacao is null or length(btrim(p_observacao)) not between 1 and 2000 then
    raise exception 'conferencia_invalida' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('tipo', 'anotarConferencia', 'loteId', p_lote_id,
    'chaveLinha', p_chave_linha, 'expectedRevision', p_expected_revision, 'observacao', btrim(p_observacao));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_comando from pcm.sso_levantamento_comandos where request_id = p_request_id;
  select * into v_lote from pcm.sso_levantamentos where id = p_lote_id for update;
  if not found or not config.sso_autorizar_acao('cadastro.aprovar', v_lote.cliente_id) then
    raise exception 'levantamento_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  if v_comando.request_id is not null then
    if v_comando.ator_id is distinct from v_ator or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return v_comando.resultado;
  end if;
  if v_lote.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if not exists (select 1 from pcm.sso_levantamento_linhas where lote_id = p_lote_id and chave = p_chave_linha) then
    raise exception 'linha_nao_encontrada' using errcode = '23514';
  end if;
  update pcm.sso_levantamentos set revisao = revisao + 1 where id = p_lote_id returning * into v_lote;
  insert into pcm.sso_levantamento_conferencias(lote_id, chave_linha, revisao_lote, observacao, ator_id)
    values (p_lote_id, p_chave_linha, v_lote.revisao, btrim(p_observacao), v_ator) returning id into v_id;
  v_resultado := jsonb_build_object('aggregateId', p_lote_id, 'revision', v_lote.revisao, 'state', 'pendente',
    'created', true, 'linkedIds', jsonb_build_object('conferenciaId', v_id), 'warnings', '[]'::jsonb, 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload) values (v_ator,
    'levantamento.conferencia_anotada', 'sso_levantamentos', p_lote_id,
    jsonb_build_object('requestId', p_request_id, 'linha', p_chave_linha, 'revision', v_lote.revisao));
  insert into pcm.sso_levantamento_comandos(request_id, ator_id, payload, resultado)
    values (p_request_id, v_ator, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_anotar_conferencia_levantamento(uuid,uuid,text,integer,text) from public, anon, service_role;
grant execute on function pcm.sso_anotar_conferencia_levantamento(uuid,uuid,text,integer,text) to authenticated;

create function pcm.sso_listar_conferencias_levantamento(p_lote_id uuid, p_chave_linha text, p_apos_revision integer, p_limite integer)
returns table (id uuid, revisao_lote integer, observacao text, ator_id uuid, criado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_cliente uuid;
begin
  select cliente_id into v_cliente from pcm.sso_levantamentos where id = p_lote_id;
  if v_cliente is null or not config.sso_autorizar_acao('cadastro.aprovar', v_cliente) then
    raise exception 'levantamento_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  if p_limite is null or p_limite not between 1 and 100 or p_chave_linha is null
    or length(btrim(p_chave_linha)) not between 1 and 200 or (p_apos_revision is not null and p_apos_revision < 0) then
    raise exception 'paginacao_invalida' using errcode = '22023';
  end if;
  return query select c.id, c.revisao_lote, c.observacao, c.ator_id, c.criado_em
    from pcm.sso_levantamento_conferencias c where c.lote_id = p_lote_id and c.chave_linha = p_chave_linha
    and (p_apos_revision is null or c.revisao_lote > p_apos_revision) order by c.revisao_lote limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_conferencias_levantamento(uuid,text,integer,integer) from public, anon, service_role;
grant execute on function pcm.sso_listar_conferencias_levantamento(uuid,text,integer,integer) to authenticated;
