-- 0077_E01-S58_reconciliacao_tarefas_excluidas.sql
-- Reverso: DROP FUNCTION IF EXISTS pcm.fn_cancelar_os_tarefas_auvo_excluidas(bigint[]);

create or replace function pcm.fn_registrar_os_status_evento()
returns trigger
language plpgsql
security definer
set search_path = pcm, public
as $$
declare
  origem_evento text := coalesce(nullif(current_setting('app.os_status_event_origin', true), ''), 'pcm');
  metadata_evento jsonb := coalesce(nullif(current_setting('app.os_status_event_metadata', true), ''), '{}')::jsonb;
begin
  if tg_op = 'INSERT' then
    insert into pcm.os_status_eventos (ordem_servico_id, status_anterior, status_novo, origem, metadata, created_by)
    values (new.id, null, new.status, 'criacao', jsonb_build_object('numero', new.numero, 'origem_os', new.origem), new.created_by);
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into pcm.os_status_eventos (ordem_servico_id, status_anterior, status_novo, origem, metadata, created_by)
    values (
      new.id,
      old.status,
      new.status,
      origem_evento,
      jsonb_build_object('numero', new.numero, 'auvo_task_id', new.auvo_task_id, 'auvo_sync_status', new.auvo_sync_status) || metadata_evento,
      coalesce(new.updated_by, new.created_by)
    );
  end if;
  return new;
end;
$$;

create or replace function pcm.fn_cancelar_os_tarefas_auvo_excluidas(p_auvo_task_ids bigint[])
returns table(canceladas integer, ja_canceladas integer, finalizadas_ignoradas integer)
language plpgsql
security invoker
set search_path = pcm, public
as $$
declare
  ids bigint[] := coalesce(p_auvo_task_ids, '{}'::bigint[]);
begin
  if cardinality(ids) = 0 then
    return query select 0, 0, 0;
    return;
  end if;

  select count(*)::integer into ja_canceladas
  from pcm.ordens_servico
  where auvo_task_id = any(ids) and status = 'cancelado';

  select count(*)::integer into finalizadas_ignoradas
  from pcm.ordens_servico
  where auvo_task_id = any(ids) and status = 'finalizado';

  perform set_config('app.os_status_event_origin', 'auvo_deleted_task', true);
  perform set_config('app.os_status_event_metadata', jsonb_build_object('motivo', 'excluida_no_auvo')::text, true);

  update pcm.ordens_servico
  set status = 'cancelado', updated_at = now()
  where auvo_task_id = any(ids)
    and status not in ('cancelado', 'finalizado');

  get diagnostics canceladas = row_count;
  return next;
end;
$$;

grant execute on function pcm.fn_cancelar_os_tarefas_auvo_excluidas(bigint[]) to service_role;
