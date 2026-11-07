-- ADR-0121: rejeição em staging apenas; sem incorporação ao cadastro oficial.
create table pcm.sso_levantamento_rejeicoes (
  lote_id uuid not null,
  linha_chave text not null,
  revisao integer not null check (revisao > 1),
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  ator_id uuid not null references config.usuarios(user_id),
  request_id uuid not null unique,
  ocorrido_em timestamptz not null default now(),
  primary key (lote_id, linha_chave),
  foreign key (lote_id, linha_chave) references pcm.sso_levantamento_linhas(lote_id, chave),
  unique (lote_id, revisao)
);
alter table pcm.sso_levantamento_rejeicoes enable row level security;
alter table pcm.sso_levantamento_rejeicoes force row level security;
revoke all on pcm.sso_levantamento_rejeicoes from public, anon, authenticated, service_role;

create function pcm.sso_rejeitar_linha_levantamento(
  p_request_id uuid, p_lote_id uuid, p_expected_revision integer, p_chave text, p_motivo text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ator uuid := auth.uid(); v_lote pcm.sso_levantamentos%rowtype;
  v_comando pcm.sso_levantamento_comandos%rowtype; v_payload jsonb; v_resultado jsonb;
begin
  if p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision < 1
    or p_chave is null or length(btrim(p_chave)) not between 1 and 200
    or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_lote from pcm.sso_levantamentos where id = p_lote_id for update;
  if not found or config.sso_autorizar_acao('cadastro.aprovar', v_lote.cliente_id) is not true then
    raise exception 'levantamento_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  v_payload := jsonb_build_object('operacao', 'rejeitar_linha', 'loteId', p_lote_id,
    'expectedRevision', p_expected_revision, 'chave', p_chave, 'motivo', p_motivo);
  select * into v_comando from pcm.sso_levantamento_comandos where request_id = p_request_id;
  if found then
    if v_comando.ator_id is distinct from v_ator or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return v_comando.resultado;
  end if;
  if v_lote.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if not exists(select 1 from pcm.sso_levantamento_linhas l where l.lote_id = p_lote_id and l.chave = p_chave) then
    raise exception 'linha_nao_encontrada' using errcode = '23514';
  end if;
  if exists(select 1 from pcm.sso_levantamento_rejeicoes r where r.lote_id = p_lote_id and r.linha_chave = p_chave) then
    raise exception 'linha_ja_rejeitada' using errcode = '23505';
  end if;
  update pcm.sso_levantamentos set revisao = revisao + 1 where id = p_lote_id returning * into v_lote;
  insert into pcm.sso_levantamento_rejeicoes(lote_id, linha_chave, revisao, motivo, ator_id, request_id)
    values (p_lote_id, p_chave, v_lote.revisao, p_motivo, v_ator, p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_ator, 'levantamento.linha_rejeitada', 'sso_levantamentos', p_lote_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_lote.cliente_id, 'revision', v_lote.revisao, 'linhaChave', p_chave));
  v_resultado := jsonb_build_object('aggregateId', p_lote_id, 'revision', v_lote.revisao, 'state', 'pendente',
    'created', false, 'linkedIds', '{}'::jsonb, 'warnings', '[]'::jsonb, 'requestId', p_request_id);
  insert into pcm.sso_levantamento_comandos(request_id, ator_id, payload, resultado)
    values (p_request_id, v_ator, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_rejeitar_linha_levantamento(uuid, uuid, integer, text, text) from public, anon, authenticated, service_role;

create function pcm.sso_listar_rejeicoes_levantamento(p_lote_id uuid, p_limite integer, p_apos text default null)
returns table(linha_chave text, revisao integer, motivo text, ator_id uuid, ocorrido_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_cliente uuid;
begin
  if p_lote_id is null or p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and length(p_apos) > 200) then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  select cliente_id into v_cliente from pcm.sso_levantamentos where id = p_lote_id;
  if not found or config.sso_autorizar_acao('cadastro.aprovar', v_cliente) is not true then
    raise exception 'levantamento_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  return query select r.linha_chave, r.revisao, r.motivo, r.ator_id, r.ocorrido_em
    from pcm.sso_levantamento_rejeicoes r where r.lote_id = p_lote_id and (p_apos is null or r.linha_chave > p_apos)
    order by r.linha_chave limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_rejeicoes_levantamento(uuid, integer, text) from public, anon, authenticated, service_role;
