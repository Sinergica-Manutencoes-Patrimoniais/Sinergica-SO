-- ADR-0186: gate de 0410 fechado; RPCs revogadas; não modifica Financeiro.
create table pcm.despesa_visita_correcoes_realizacao (
  despesa_id uuid not null references pcm.despesas_visita(id), revisao integer not null check (revisao > 1),
  valor_anterior bigint not null check (valor_anterior >= 0), valor_novo bigint not null check (valor_novo >= 0),
  objeto_anterior uuid not null, caminho_anterior text not null, objeto_novo uuid not null, caminho_novo text not null,
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  conferencia_financeira text not null check (length(btrim(conferencia_financeira)) between 1 and 2000),
  ator_id uuid not null references auth.users(id), request_id uuid not null unique,
  criado_em timestamptz not null default now(), primary key(despesa_id, revisao)
);
alter table pcm.despesa_visita_correcoes_realizacao enable row level security;
alter table pcm.despesa_visita_correcoes_realizacao force row level security;
revoke all on pcm.despesa_visita_correcoes_realizacao from public, anon, authenticated, service_role;

-- Também permite preparar novo comprovante de despesa ativa já realizada. Continua
-- sem grant e sem leitura Storage; nenhuma alteração de despesa ocorre no upload.
create or replace function pcm.sso_autorizar_upload_comprovante(p_nome text)
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
    and d.cliente_id = v_cliente and d.status = 'ativa'
    and config.sso_autorizar_acao('despesa_visita.gerir', d.cliente_id) is true);
end;
$$;
revoke all on function pcm.sso_autorizar_upload_comprovante(text) from public, anon, authenticated, service_role;

create function pcm.sso_corrigir_realizacao_despesa(p_request_id uuid, p_despesa_id uuid,
  p_expected_revision integer, p_valor_centavos bigint, p_comprovante_objeto_id uuid,
  p_motivo text, p_conferencia_financeira text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_despesa pcm.despesas_visita%rowtype; v_comando pcm.despesa_visita_comandos%rowtype;
  v_payload jsonb; v_resultado jsonb; v_objeto_antigo uuid; v_caminho_antigo text;
  v_objeto_novo uuid; v_caminho_novo text; v_valor_antigo bigint;
begin
  if auth.uid() is null or p_request_id is null or p_despesa_id is null or p_expected_revision is null or p_expected_revision < 1
    or p_valor_centavos is null or p_valor_centavos not between 0 and 9007199254740991
    or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000
    or p_conferencia_financeira is null or length(btrim(p_conferencia_financeira)) not between 1 and 2000 then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('despesa-visita-request:' || p_request_id::text, 0));
  select * into v_despesa from pcm.despesas_visita where id = p_despesa_id for update;
  if not found or config.sso_autorizar_acao('despesa_visita.gerir', v_despesa.cliente_id) is not true then
    raise exception 'despesa_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  v_payload := jsonb_build_object('operacao', 'corrigir_realizacao', 'despesaId', p_despesa_id,
    'expectedRevision', p_expected_revision, 'valorCentavos', p_valor_centavos, 'comprovanteObjetoId', p_comprovante_objeto_id,
    'motivo', btrim(p_motivo), 'conferenciaFinanceira', btrim(p_conferencia_financeira));
  select * into v_comando from pcm.despesa_visita_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from auth.uid() or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if not coalesce((select habilitado from pcm.sso_correcao_despesa_gate where id), false) then
    raise exception 'correcao_indisponivel' using errcode = '55000'; end if;
  if v_despesa.revisao <> p_expected_revision or v_despesa.status <> 'ativa' then
    raise exception 'revisao_ou_estado_invalido' using errcode = '40001'; end if;
  if v_despesa.realizado_centavos is null then raise exception 'realizacao_nao_comprovada' using errcode = '23514'; end if;
  if exists (select 1 from financeiro.itens_faturaveis f where f.cliente_id = v_despesa.cliente_id
    and f.origem_tipo = 'despesa_visita' and f.origem_id = p_despesa_id and
    (f.status <> 'cancelado' or exists (select 1 from financeiro.sso_faturavel_alocacoes a where a.item_id = f.id))) then
    raise exception 'origem_exige_reconciliacao_financeira' using errcode = '23514'; end if;
  select c.objeto_novo, c.caminho_novo into v_objeto_antigo, v_caminho_antigo
    from pcm.despesa_visita_correcoes_realizacao c where c.despesa_id = p_despesa_id order by c.revisao desc limit 1;
  if not found then select r.comprovante_objeto_id, r.comprovante_caminho into v_objeto_antigo, v_caminho_antigo
    from pcm.despesa_visita_realizacoes r where r.despesa_id = p_despesa_id; end if;
  if v_objeto_antigo is null then raise exception 'realizacao_nao_comprovada' using errcode = '23514'; end if;
  v_objeto_novo := coalesce(p_comprovante_objeto_id, v_objeto_antigo);
  if p_comprovante_objeto_id is null then v_caminho_novo := v_caminho_antigo;
  else
    select o.name into v_caminho_novo from storage.objects o join storage.buckets b on b.id = o.bucket_id
      where o.id = p_comprovante_objeto_id and o.bucket_id = 'sso-despesas-visita' and b.public is false
        and o.owner_id = auth.uid()::text and split_part(o.name, '/', 1) = v_despesa.cliente_id::text
        and split_part(o.name, '/', 2) = p_despesa_id::text and pcm.sso_autorizar_upload_comprovante(o.name) is true for share of o;
    if not found or exists (select 1 from pcm.despesa_visita_realizacoes r where r.comprovante_objeto_id = p_comprovante_objeto_id)
      or exists (select 1 from pcm.despesa_visita_correcoes_realizacao c where c.objeto_novo = p_comprovante_objeto_id) then
      raise exception 'comprovante_indisponivel' using errcode = '23514'; end if;
  end if;
  if v_despesa.realizado_centavos = p_valor_centavos and v_objeto_antigo = v_objeto_novo then
    raise exception 'nenhuma_alteracao' using errcode = '22023'; end if;
  v_valor_antigo := v_despesa.realizado_centavos;
  update pcm.despesas_visita set realizado_centavos = p_valor_centavos, revisao = revisao + 1
    where id = p_despesa_id returning * into v_despesa;
  insert into pcm.despesa_visita_correcoes_realizacao(despesa_id, revisao, valor_anterior, valor_novo,
    objeto_anterior, caminho_anterior, objeto_novo, caminho_novo, motivo, conferencia_financeira, ator_id, request_id)
    values (p_despesa_id, v_despesa.revisao, v_valor_antigo, p_valor_centavos, v_objeto_antigo, v_caminho_antigo,
      v_objeto_novo, v_caminho_novo, btrim(p_motivo), btrim(p_conferencia_financeira), auth.uid(), p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'despesa_visita.realizacao_corrigida', 'despesas_visita', p_despesa_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_despesa.cliente_id, 'revision', v_despesa.revisao));
  v_resultado := jsonb_build_object('aggregateId', p_despesa_id, 'revision', v_despesa.revisao,
    'state', v_despesa.status, 'requestId', p_request_id, 'linkedIds', jsonb_build_object('visitaId', v_despesa.visita_id));
  insert into pcm.despesa_visita_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, auth.uid(), v_despesa.cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_corrigir_realizacao_despesa(uuid, uuid, integer, bigint, uuid, text, text)
  from public, anon, authenticated, service_role;

create or replace function pcm.sso_comprovante_despesa_autorizado(p_despesa_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_caminho text;
begin
  if auth.uid() is null or p_despesa_id is null then raise exception 'comprovante_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  select coalesce(c.caminho_novo, r.comprovante_caminho) into v_caminho
    from pcm.despesas_visita d join pcm.despesa_visita_realizacoes r on r.despesa_id = d.id
    left join lateral (select cor.objeto_novo, cor.caminho_novo from pcm.despesa_visita_correcoes_realizacao cor
      where cor.despesa_id = d.id order by cor.revisao desc limit 1) c on true
    join storage.objects o on o.id = coalesce(c.objeto_novo, r.comprovante_objeto_id)
      and o.name = coalesce(c.caminho_novo, r.comprovante_caminho)
    join storage.buckets b on b.id = o.bucket_id and b.public is false
    where d.id = p_despesa_id and o.bucket_id = 'sso-despesas-visita'
      and config.sso_autorizar_acao('despesa_visita.gerir', d.cliente_id) is true;
  if v_caminho is null then raise exception 'comprovante_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  return v_caminho;
end;
$$;
revoke all on function pcm.sso_comprovante_despesa_autorizado(uuid) from public, anon, authenticated, service_role;
