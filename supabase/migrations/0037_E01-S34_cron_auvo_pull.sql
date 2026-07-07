-- 0037_E01-S34_cron_auvo_pull.sql — Sinérgica SO
-- Liga de verdade o cron do motor genérico (E01-S22/E01-S23): 9 entidades declaravam
-- `cronSchedule` no registry TS desde E01-S24..S32, mas nenhuma migration jamais criou o
-- `pg_cron` que chama `pcm-auvo-pull` — era metadado morto. Esta migration termina o que
-- E01-S23 deixou pela metade, mais o cron de segurança de Tickets (E01-S33, webhook-only até
-- aqui). Ver specs/E01-S34-reconciliacao-sync-auvo-pcm/design.md.
--
-- Reusa os MESMOS secrets do Vault já criados em 0011/0013/0025 (auvo_trigger_project_url /
-- auvo_trigger_service_role_key) — nenhum segredo novo.
--
-- Lista de entidades por schedule é hardcoded aqui (mesmo padrão de 0013, que já hardcoda nomes
-- de função) — duplicação consciente do que o registry TS declara; se uma entidade nova ganhar
-- `cronSchedule`, precisa entrar manualmente num destes arrays (ou abrir um cron.schedule novo,
-- se o horário for diferente dos 3 já existentes).
--
-- Reverso:
--   select cron.unschedule('pcm_auvo_pull_diario');
--   select cron.unschedule('pcm_auvo_pull_6h');
--   select cron.unschedule('pcm_auvo_pull_tickets_horario');
--   drop function if exists pcm.fn_invoke_auvo_pull(text[]);

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

  -- Sem secrets configurados, não dispara — no-op silencioso (mesmo comportamento de 0011/0013/0025).
  if v_project_url is null or v_service_role_key is null then
    raise warning 'fn_invoke_auvo_pull: secrets do Vault ausentes — pull pulado (entidades: %)', p_entities;
    return;
  end if;

  -- pg_sleep(2) entre chamadas: evita disparar N requisições ao Auvo no mesmo segundo quando
  -- várias entidades compartilham o mesmo horário (risco sinalizado em product.md → Riscos).
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
    exception
      when others then
        -- Uma entidade falhando não derruba as outras do mesmo job.
        raise warning 'fn_invoke_auvo_pull: falha ao disparar pull de % — %', v_entity, SQLERRM;
    end;
    perform pg_sleep(2);
  end loop;
end;
$$;

revoke all on function pcm.fn_invoke_auvo_pull(text[]) from public;

-- Diário 06:00 UTC — as 6 entidades com cronSchedule:'0 6 * * *' no registry (catálogo de baixa
-- volatilidade: tipos de tarefa, segmentos, palavras-chave, categorias, grupos de clientes).
select cron.schedule(
  'pcm_auvo_pull_diario',
  '0 6 * * *',
  $cron$select pcm.fn_invoke_auvo_pull(array['tipos_tarefa','segmentos','palavras_chave','produto_categorias','equipamento_categorias','cliente_grupos']);$cron$
);

-- A cada 6h — as 3 entidades com cronSchedule:'0 */6 * * *' (dado operacional, muda mais rápido).
select cron.schedule(
  'pcm_auvo_pull_6h',
  '0 */6 * * *',
  $cron$select pcm.fn_invoke_auvo_pull(array['ferramentas','servicos','equipes']);$cron$
);

-- A cada hora — Tickets (E01-S34): rede de segurança além do webhook, dado mais vivo que catálogo.
select cron.schedule(
  'pcm_auvo_pull_tickets_horario',
  '0 * * * *',
  $cron$select pcm.fn_invoke_auvo_pull(array['tickets']);$cron$
);

-- ── Verificação (rode após aplicar) ────────────────────────────────────────
-- select jobid, jobname, schedule, command from cron.job where jobname like 'pcm_auvo_pull_%';
-- -- disparo manual de teste (após configurar os secrets do Vault):
-- select pcm.fn_invoke_auvo_pull(array['tipos_tarefa']);
