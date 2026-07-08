-- 0051_E01-S36_drain_imediato.sql — Sinérgica SO
-- Story E01-S36. `fn_auvo_enqueue()` (0024) grava a linha no outbox mas só o cron de 1 min
-- (0025) drenava — uma alteração no PCM podia levar até 60s para sequer TENTAR propagar ao Auvo
-- (e nem tentava de verdade, já que todo descriptor ainda nasce `writeEnabled:false`, ver registry/).
-- Esta migration dispara `pcm-auvo-push` IMEDIATAMENTE após o enqueue, via `pg_net` — mesmo padrão
-- e mesmos secrets do Vault já usados por `0011`/`0037`/`0038` (nenhum secret novo). O cron de 1
-- min continua existindo como rede de segurança (retry de linhas `error`, disparo perdido por
-- falha do pg_net). Ver specs/E01-S36-write-path-instantaneo-auvo/design.md → "Drain imediato
-- pós-enqueue" (Opção A recomendada no design, mas implementada aqui como Opção B — dispatch
-- direto da trigger via pg_net — porque cobre TODA escrita, inclusive fora do adapter do
-- front-end, com uma única mudança central em vez de tocar em cada adapter individualmente;
-- SPEC_DEVIATION registrado em tasks.md).
--
-- Falha do pg_net (secret ausente, rede fora, etc.) NUNCA bloqueia a escrita de origem — mesmo
-- princípio de 0011 (raise warning, segue em frente). O cron pega o que este disparo perder.
--
-- Reverso:
--   -- restaura fn_auvo_enqueue() para a versão de 0024 (sem o dispatch pg_net):
--   -- ver corpo da função em 0024_E01-S22_auvo_sync_outbox.sql e reaplicar com create or replace.

create or replace function pcm.fn_auvo_enqueue()
returns trigger
language plpgsql
security definer
set search_path = pcm, extensions, vault, public
as $$
declare
  v_entity text := TG_ARGV[0];
  v_row_id uuid;
  v_op text;
  v_project_url text;
  v_service_role_key text;
  v_request_id bigint;
begin
  if current_setting('app.auvo_sync_write', true) = 'true' then
    if TG_OP = 'DELETE' then
      return OLD;
    end if;
    return NEW;
  end if;

  if TG_OP = 'DELETE' then
    v_row_id := OLD.id;
    v_op := 'delete';
  elsif TG_OP = 'INSERT' then
    v_row_id := NEW.id;
    v_op := 'create';
  else -- UPDATE
    v_row_id := NEW.id;
    if NEW.deleted_at is not null and OLD.deleted_at is null then
      v_op := 'delete';
    else
      v_op := 'update';
    end if;
  end if;

  insert into pcm.auvo_sync_outbox (entity, row_id, op) values (v_entity, v_row_id, v_op);

  -- Drain imediato (E01-S36) — best-effort, nunca bloqueia a escrita de origem.
  begin
    select decrypted_secret into v_project_url
      from vault.decrypted_secrets where name = 'auvo_trigger_project_url' limit 1;
    select decrypted_secret into v_service_role_key
      from vault.decrypted_secrets where name = 'auvo_trigger_service_role_key' limit 1;

    if v_project_url is null or v_service_role_key is null then
      raise warning 'fn_auvo_enqueue: secrets do Vault ausentes — drain imediato pulado para entity=%, row=% (cron de 1 min ainda processa)', v_entity, v_row_id;
    else
      select net.http_post(
        url := v_project_url || '/functions/v1/pcm-auvo-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := '{}'::jsonb
      ) into v_request_id;
    end if;
  exception
    when others then
      raise warning 'fn_auvo_enqueue: falha ao disparar drain imediato para entity=%, row=% — % (cron de 1 min ainda processa)', v_entity, v_row_id, SQLERRM;
  end;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

-- ── Verificação (rode após aplicar) ────────────────────────────────────────
-- select proname, prosecdef from pg_proc where proname = 'fn_auvo_enqueue';
-- -- teste manual (após configurar os secrets do Vault, ver 0011):
-- update pcm.funcionarios set nome = nome where id = '<uuid de teste>'; -- deve enfileirar + disparar pg_net
-- select id, entity, status, enqueued_at, sent_at, last_error from pcm.auvo_sync_outbox order by enqueued_at desc limit 5;
