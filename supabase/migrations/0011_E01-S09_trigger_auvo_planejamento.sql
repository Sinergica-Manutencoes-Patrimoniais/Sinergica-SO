-- 0011_E01-S09_trigger_auvo_planejamento.sql — Sinérgica SO
-- Story E01-S09. Trigger assíncrono (pg_net) em pcm.ordens_servico: quando `status` transiciona
-- para 'planejamento', dispara HTTP POST para a Edge Function `pcm-auvo-create-task` — SEM
-- bloquear o UPDATE da OS. Falha do Auvo (ou do próprio pg_net) nunca trava o *system of record*
-- do PCM — princípio central de docs/adr/0001-pcm-origin-truth-externalid.md e
-- specs/E01-S09-integracao-auvo-fundacao/design.md (→ Alternativas consideradas: trigger síncrono
-- foi rejeitado por esse motivo).
--
-- Pré-requisito manual, uma vez, ANTES desta migration ser útil em produção (segredo — nunca em
-- migration versionada, ver seguranca/os-grade.md "secrets em Vault"):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'auvo_trigger_project_url');
--   select vault.create_secret('<service_role_key real>', 'auvo_trigger_service_role_key');
-- Sem esses dois secrets no Vault, a função-trigger roda em no-op silencioso (ver corpo abaixo) —
-- o UPDATE da OS continua funcionando normalmente, só o disparo ao Auvo não acontece até os
-- secrets serem configurados.
--
-- Reverso:
--   drop trigger if exists trg_auvo_create_task_on_planejamento on pcm.ordens_servico;
--   drop function if exists pcm.fn_auvo_create_task_on_planejamento();
--   -- extensão pg_net NÃO é removida no reverso (pode já estar em uso por outra migration).

create extension if not exists pg_net with schema extensions;

create or replace function pcm.fn_auvo_create_task_on_planejamento()
returns trigger
language plpgsql
security definer
set search_path = pcm, extensions, vault, public
as $$
declare
  v_project_url text;
  v_service_role_key text;
  v_request_id bigint;
begin
  -- Só dispara em UPDATE com transição REAL para 'planejamento' (evita reprocessar em todo
  -- UPDATE que não muda status, e evita INSERT direto com status inicial 'planejamento' —
  -- cenário não esperado pelo fluxo do domínio, mas o guard TG_OP cobre por segurança).
  if TG_OP <> 'UPDATE' then
    return NEW;
  end if;

  if NEW.status <> 'planejamento' or OLD.status is not distinct from NEW.status then
    return NEW;
  end if;

  select decrypted_secret into v_project_url
    from vault.decrypted_secrets where name = 'auvo_trigger_project_url' limit 1;
  select decrypted_secret into v_service_role_key
    from vault.decrypted_secrets where name = 'auvo_trigger_service_role_key' limit 1;

  -- Sem os secrets configurados no Vault, não bloqueia o UPDATE — só não dispara o efeito
  -- colateral (a OS fica sem auvo_sync_status atualizado; reconciliação manual documentada em
  -- design.md → Riscos, até a fase 2 de fila/cron).
  if v_project_url is null or v_service_role_key is null then
    raise warning 'fn_auvo_create_task_on_planejamento: secrets do Vault ausentes (auvo_trigger_project_url/auvo_trigger_service_role_key) — disparo ao Auvo pulado para OS %', NEW.id;
    return NEW;
  end if;

  select net.http_post(
    url := v_project_url || '/functions/v1/pcm-auvo-create-task',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := jsonb_build_object('osId', NEW.id)
  ) into v_request_id;

  return NEW;
exception
  when others then
    -- Nunca deixa a exceção propagar e travar o UPDATE da OS — é o princípio central do design
    -- (falha do Auvo/pg_net nunca é falha do PCM). Fica visível via RAISE WARNING nos logs do
    -- Postgres (Dashboard → Logs); sem alerta automático nesta fase (design.md → Observabilidade).
    raise warning 'fn_auvo_create_task_on_planejamento: falha ao disparar pg_net para OS % — %', NEW.id, SQLERRM;
    return NEW;
end;
$$;

drop trigger if exists trg_auvo_create_task_on_planejamento on pcm.ordens_servico;

create trigger trg_auvo_create_task_on_planejamento
  after update on pcm.ordens_servico
  for each row
  execute function pcm.fn_auvo_create_task_on_planejamento();

-- ── Verificação (rode após aplicar) ────────────────────────────────────────
-- select tgname, tgrelid::regclass, tgenabled from pg_trigger where tgname = 'trg_auvo_create_task_on_planejamento';
-- select proname, prosecdef from pg_proc where proname = 'fn_auvo_create_task_on_planejamento';
-- -- teste manual (após configurar os secrets do Vault):
-- update pcm.ordens_servico set status = 'planejamento' where id = '<uuid de teste>';
-- select id, auvo_task_id, auvo_sync_status, auvo_sync_error from pcm.ordens_servico where id = '<uuid de teste>';
