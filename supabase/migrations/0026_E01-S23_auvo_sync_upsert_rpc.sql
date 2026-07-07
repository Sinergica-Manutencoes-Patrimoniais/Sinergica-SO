-- 0026_E01-S23_auvo_sync_upsert_rpc.sql — Sinérgica SO
-- Story E01-S23. RPC genérica para o sentido Auvo→PCM fazer upsert por `auvo_id` com o mesmo
-- anti-loop de `fn_apply_auvo_sync`: seta `app.auvo_sync_write=true` antes de UPDATE/INSERT para
-- que triggers `pcm.fn_auvo_enqueue()` não reenfileirem a escrita inbound.

create or replace function pcm.fn_upsert_auvo_sync(
  p_table text,
  p_auvo_id text,
  p_patch jsonb
) returns uuid
language plpgsql
security definer
set search_path = pcm, public
as $$
declare
  v_existing_id uuid;
  v_columns text;
  v_values text;
  v_set_clause text;
  v_result_id uuid;
begin
  if p_table is null or p_table = '' then
    raise exception 'p_table obrigatório';
  end if;

  if p_auvo_id is null or p_auvo_id = '' then
    raise exception 'p_auvo_id obrigatório';
  end if;

  perform set_config('app.auvo_sync_write', 'true', true);

  execute format('select id from pcm.%I where auvo_id::text = $1 limit 1', p_table)
    into v_existing_id
    using p_auvo_id;

  -- jsonb_each_text() devolveria a sintaxe JSON de array (`[1,2]`), que o Postgres não aceita como
  -- literal de coluna array (espera `{1,2}`) — por isso colunas array são convertidas à parte via
  -- jsonb_array_elements_text() antes de virar literal `%L`. Colunas escalares seguem via `#>>'{}'`
  -- (equivalente ao valor de jsonb_each_text para não-array).
  select string_agg(
    format(
      '%I = %L',
      t.key,
      case
        when jsonb_typeof(t.value) = 'array' then
          '{' || (select string_agg(elem, ',') from jsonb_array_elements_text(t.value) as elem) || '}'
        when jsonb_typeof(t.value) = 'null' then null
        else t.value #>> '{}'
      end
    ),
    ', '
  )
    into v_set_clause
    from jsonb_each(p_patch) as t(key, value);

  if v_existing_id is not null then
    if v_set_clause is not null then
      execute format('update pcm.%I set %s where id = $1 returning id', p_table, v_set_clause)
        into v_result_id
        using v_existing_id;
      return v_result_id;
    end if;
    return v_existing_id;
  end if;

  select
    string_agg(format('%I', t.key), ', '),
    string_agg(
      format(
        '%L',
        case
          when jsonb_typeof(t.value) = 'array' then
            '{' || (select string_agg(elem, ',') from jsonb_array_elements_text(t.value) as elem) || '}'
          when jsonb_typeof(t.value) = 'null' then null
          else t.value #>> '{}'
        end
      ),
      ', '
    )
    into v_columns, v_values
    from jsonb_each(p_patch || jsonb_build_object('auvo_id', p_auvo_id)) as t(key, value);

  execute format('insert into pcm.%I (%s) values (%s) returning id', p_table, v_columns, v_values)
    into v_result_id;

  return v_result_id;
end;
$$;

revoke all on function pcm.fn_upsert_auvo_sync(text, text, jsonb) from public;
grant execute on function pcm.fn_upsert_auvo_sync(text, text, jsonb) to service_role;

comment on function pcm.fn_upsert_auvo_sync(text, text, jsonb)
  is 'E01-S23: upsert inbound Auvo→PCM por auvo_id com GUC app.auvo_sync_write para anti-loop.';

create or replace function pcm.fn_soft_delete_missing_auvo_sync(
  p_table text,
  p_auvo_ids text[]
) returns int
language plpgsql
security definer
set search_path = pcm, public
as $$
declare
  v_count int := 0;
begin
  if p_table is null or p_table = '' then
    raise exception 'p_table obrigatório';
  end if;

  if p_auvo_ids is null or array_length(p_auvo_ids, 1) is null then
    return 0;
  end if;

  perform set_config('app.auvo_sync_write', 'true', true);

  execute format(
    'update pcm.%I set deleted_at = coalesce(deleted_at, now()), updated_at = now() where auvo_id is not null and deleted_at is null and not (auvo_id::text = any ($1))',
    p_table
  )
    using p_auvo_ids;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function pcm.fn_soft_delete_missing_auvo_sync(text, text[]) from public;
grant execute on function pcm.fn_soft_delete_missing_auvo_sync(text, text[]) to service_role;

comment on function pcm.fn_soft_delete_missing_auvo_sync(text, text[])
  is 'E01-S23: reconcilia registros locais que sumiram do pull Auvo, com guarda de resultado vazio no chamador.';
