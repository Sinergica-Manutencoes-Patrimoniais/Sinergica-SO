-- 0069_E01-S34_fix_array_vazio_upsert_auvo_sync.sql — Sinérgica SO
-- Achado testando "Sincronizar Auvo" com credenciais reais (2026-07-08): pull:equipes sempre
-- falhava com 500 "Erro interno". Causa: fn_upsert_auvo_sync (0026) converte array jsonb pra
-- literal `{...}` via `jsonb_array_elements_text` + `string_agg` — mas `string_agg` sobre um
-- array VAZIO devolve NULL, não string vazia, e `'{' || NULL || '}'` também é NULL. `format('%L',
-- NULL)` grava a palavra-chave SQL `NULL` na coluna. Equipes tem `participantes_auvo_ids` e
-- `gestores_auvo_ids` `NOT NULL` (0035) — todo INSERT/UPDATE com array vazio violava a constraint.
-- Fix: `coalesce(..., '')` garante `'{}'` (array vazio válido) em vez de `NULL` quando não há elementos.
--
-- Reverso: reaplicar a versão anterior de fn_upsert_auvo_sync definida em 0026.

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

  select string_agg(
    format(
      '%I = %L',
      t.key,
      case
        when jsonb_typeof(t.value) = 'array' then
          '{' || coalesce((select string_agg(elem, ',') from jsonb_array_elements_text(t.value) as elem), '') || '}'
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
            '{' || coalesce((select string_agg(elem, ',') from jsonb_array_elements_text(t.value) as elem), '') || '}'
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

comment on function pcm.fn_upsert_auvo_sync(text, text, jsonb)
  is 'E01-S23/E01-S34: upsert inbound Auvo→PCM por auvo_id com GUC app.auvo_sync_write para anti-loop. Array vazio vira {} (0069), nunca NULL.';
