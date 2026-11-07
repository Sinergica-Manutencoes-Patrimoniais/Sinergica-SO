-- ADR-0141. Preparação: funções revogadas; não aplicar nem conceder antes de revisão.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sso-despesas-visita', 'sso-despesas-visita', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create function pcm.sso_autorizar_upload_comprovante(p_nome text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_partes text[]; v_cliente uuid; v_despesa uuid;
begin
  if auth.uid() is null or p_nome is null then return false; end if;
  v_partes := string_to_array(p_nome, '/');
  if pg_catalog.array_length(v_partes, 1) is distinct from 3
    or v_partes[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or v_partes[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or v_partes[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  v_cliente := v_partes[1]::uuid; v_despesa := v_partes[2]::uuid;
  return exists (select 1 from pcm.despesas_visita d where d.id = v_despesa
    and d.cliente_id = v_cliente and d.status = 'ativa' and d.realizado_centavos is null
    and config.sso_autorizar_acao('despesa_visita.gerir', d.cliente_id) is true);
end;
$$;
revoke all on function pcm.sso_autorizar_upload_comprovante(text) from public, anon, authenticated, service_role;

create policy s180_upload_comprovante on storage.objects for insert to authenticated
  with check (bucket_id = 'sso-despesas-visita' and owner_id = auth.uid()::text
    and pcm.sso_autorizar_upload_comprovante(name));
create policy s180_limitar_upload_comprovante on storage.objects as restrictive
  for insert to authenticated with check (bucket_id <> 'sso-despesas-visita'
    or (owner_id = auth.uid()::text and pcm.sso_autorizar_upload_comprovante(name)));
-- Impede que políticas permissivas legadas abram leitura ou alteração do bucket.
create policy s180_sem_acesso_direto_comprovante on storage.objects as restrictive
  for select to authenticated using (bucket_id <> 'sso-despesas-visita');
create policy s180_sem_alteracao_comprovante on storage.objects as restrictive
  for update to authenticated using (bucket_id <> 'sso-despesas-visita')
  with check (bucket_id <> 'sso-despesas-visita');
create policy s180_sem_remocao_comprovante on storage.objects as restrictive
  for delete to authenticated using (bucket_id <> 'sso-despesas-visita');

create function pcm.sso_resolver_comprovante_upload(p_nome text)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid;
begin
  if pcm.sso_autorizar_upload_comprovante(p_nome) is not true then
    raise exception 'comprovante_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  select o.id into v_id from storage.objects o join storage.buckets b on b.id = o.bucket_id
    where o.bucket_id = 'sso-despesas-visita' and b.public is false and o.name = p_nome
      and o.owner_id = auth.uid()::text;
  if v_id is null then raise exception 'comprovante_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  return v_id;
end;
$$;
revoke all on function pcm.sso_resolver_comprovante_upload(text) from public, anon, authenticated, service_role;

-- O cliente resolve o ID gerado pelo Storage; o nome termina em nonce independente.
create or replace function pcm.sso_realizar_despesa_visita(
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
    or p_comprovante_objeto_id is null then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  v_payload := jsonb_build_object('operacao', 'realizar', 'despesaId', p_despesa_id,
    'expectedRevision', p_expected_revision, 'realizadoCentavos', p_realizado_centavos,
    'comprovanteObjetoId', p_comprovante_objeto_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('despesa-visita-request:' || p_request_id::text, 0));
  select * into v_despesa from pcm.despesas_visita where id = p_despesa_id for update;
  if not found or config.sso_autorizar_acao('despesa_visita.gerir', v_despesa.cliente_id) is not true then
    raise exception 'despesa_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  select * into v_comando from pcm.despesa_visita_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_ator or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if v_despesa.revisao <> p_expected_revision then raise exception 'revisao_divergente' using errcode = '40001'; end if;
  if v_despesa.status <> 'ativa' or v_despesa.realizado_centavos is not null then
    raise exception 'estado_invalido' using errcode = '23514'; end if;
  select o.name into v_caminho from storage.objects o join storage.buckets b on b.id = o.bucket_id
    where o.id = p_comprovante_objeto_id and o.bucket_id = 'sso-despesas-visita' and b.public is false
      and o.owner_id = v_ator::text
      and pg_catalog.split_part(o.name, '/', 1) = v_despesa.cliente_id::text
      and pg_catalog.split_part(o.name, '/', 2) = p_despesa_id::text
      and pcm.sso_autorizar_upload_comprovante(o.name) is true for share of o;
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
