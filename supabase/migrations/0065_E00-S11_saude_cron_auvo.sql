-- 0065_E00-S11_saude_cron_auvo.sql — no-op de cron sem Vault vira erro observável.
-- Reverso: reaplicar função de 0037.

create or replace function pcm.fn_invoke_auvo_pull(p_entities text[])
returns void
language plpgsql
security definer
set search_path = pcm, extensions, vault, public
as $$
declare
  v_project_url text;
  v_service_role_key text;
  v_entity text;
  v_request_id bigint;
begin
  select decrypted_secret into v_project_url
    from vault.decrypted_secrets where name = 'auvo_trigger_project_url' limit 1;
  select decrypted_secret into v_service_role_key
    from vault.decrypted_secrets where name = 'auvo_trigger_service_role_key' limit 1;

  if v_project_url is null or v_service_role_key is null then
    foreach v_entity in array p_entities loop
      insert into pcm.auvo_entity_status (
        entity, write_enabled, last_error_at, last_error, updated_at
      ) values (
        v_entity, false, now(), 'Vault auvo_trigger_* ausente; pull agendado não disparado', now()
      )
      on conflict (entity) do update set
        last_error_at = excluded.last_error_at,
        last_error = excluded.last_error,
        updated_at = excluded.updated_at;
    end loop;
    raise warning 'fn_invoke_auvo_pull: secrets do Vault ausentes — erro registrado para %', p_entities;
    return;
  end if;

  foreach v_entity in array p_entities loop
    begin
      select net.http_post(
        url := v_project_url || '/functions/v1/pcm-auvo-pull',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object('entity', v_entity)
      ) into v_request_id;
    exception when others then
      insert into pcm.auvo_entity_status (
        entity, write_enabled, last_error_at, last_error, updated_at
      ) values (
        v_entity, false, now(), left('Falha pg_net: ' || sqlerrm, 2000), now()
      )
      on conflict (entity) do update set
        last_error_at = excluded.last_error_at,
        last_error = excluded.last_error,
        updated_at = excluded.updated_at;
    end;
    perform pg_sleep(2);
  end loop;
end;
$$;

revoke all on function pcm.fn_invoke_auvo_pull(text[]) from public;
