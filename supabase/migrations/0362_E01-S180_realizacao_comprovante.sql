-- ADR-0137: comando preparado e revogado; não cria bucket nem lançamento financeiro.
create table pcm.despesa_visita_realizacoes (
  despesa_id uuid primary key references pcm.despesas_visita(id),
  revisao integer not null check (revisao > 1),
  valor_centavos bigint not null check (valor_centavos between 0 and 9007199254740991),
  comprovante_objeto_id uuid not null unique,
  comprovante_caminho text not null unique,
  ator_id uuid not null references auth.users(id),
  request_id uuid not null unique,
  criado_em timestamptz not null default now()
);
alter table pcm.despesa_visita_realizacoes enable row level security;
alter table pcm.despesa_visita_realizacoes force row level security;
revoke all on pcm.despesa_visita_realizacoes from public, anon, authenticated, service_role;

create function pcm.sso_realizar_despesa_visita(
  p_request_id uuid, p_despesa_id uuid, p_expected_revision integer,
  p_realizado_centavos bigint, p_comprovante_objeto_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ator uuid := auth.uid(); v_despesa pcm.despesas_visita%rowtype;
  v_comando pcm.despesa_visita_comandos%rowtype; v_caminho text;
  v_payload jsonb; v_resultado jsonb;
begin
  if v_ator is null or p_request_id is null or p_despesa_id is null
    or p_expected_revision is null or p_expected_revision < 1
    or p_realizado_centavos is null or p_realizado_centavos not between 0 and 9007199254740991
    or p_comprovante_objeto_id is null then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('operacao', 'realizar', 'despesaId', p_despesa_id,
    'expectedRevision', p_expected_revision, 'realizadoCentavos', p_realizado_centavos,
    'comprovanteObjetoId', p_comprovante_objeto_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('despesa-visita-request:' || p_request_id::text, 0));
  select * into v_despesa from pcm.despesas_visita where id = p_despesa_id for update;
  if not found or config.sso_autorizar_acao('despesa_visita.gerir', v_despesa.cliente_id) is not true then
    raise exception 'despesa_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  select * into v_comando from pcm.despesa_visita_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_ator or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return v_comando.resultado;
  end if;
  if v_despesa.revisao <> p_expected_revision then raise exception 'revisao_divergente' using errcode = '40001'; end if;
  if v_despesa.status <> 'ativa' or v_despesa.realizado_centavos is not null then
    raise exception 'estado_invalido' using errcode = '23514';
  end if;
  v_caminho := v_despesa.cliente_id::text || '/' || p_despesa_id::text || '/' || p_comprovante_objeto_id::text;
  perform 1 from storage.objects o join storage.buckets b on b.id = o.bucket_id
    where o.id = p_comprovante_objeto_id and o.bucket_id = 'sso-despesas-visita'
      and o.name = v_caminho and b.public is false for share of o;
  if not found then raise exception 'comprovante_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  update pcm.despesas_visita set realizado_centavos = p_realizado_centavos, revisao = revisao + 1
    where id = p_despesa_id returning * into v_despesa;
  insert into pcm.despesa_visita_realizacoes(despesa_id, revisao, valor_centavos, comprovante_objeto_id,
    comprovante_caminho, ator_id, request_id)
    values (p_despesa_id, v_despesa.revisao, p_realizado_centavos, p_comprovante_objeto_id,
      v_caminho, v_ator, p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_ator, 'despesa_visita.realizada', 'despesas_visita', p_despesa_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_despesa.cliente_id, 'revision', v_despesa.revisao));
  v_resultado := jsonb_build_object('aggregateId', p_despesa_id, 'revision', v_despesa.revisao,
    'state', 'ativa', 'created', false, 'linkedIds', jsonb_build_object('visitaId', v_despesa.visita_id),
    'warnings', '[]'::jsonb, 'requestId', p_request_id);
  insert into pcm.despesa_visita_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, v_ator, v_despesa.cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_realizar_despesa_visita(uuid, uuid, integer, bigint, uuid)
  from public, anon, authenticated, service_role;
