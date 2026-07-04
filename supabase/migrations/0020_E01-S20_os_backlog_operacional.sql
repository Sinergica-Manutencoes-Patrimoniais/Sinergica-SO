-- 0020_E01-S20_os_backlog_operacional.sql — Sinérgica SO
-- Story E01-S20. Hardening do banco para telas operacionais de OS + Backlog GUT.
--
-- `pcm.ordens_servico` já nasce em 0001. Esta migration adiciona o histórico append-only de
-- mudança de status, para a UI operacional não depender só do estado atual da OS.

create table if not exists pcm.os_status_eventos (
  id                 uuid        primary key default gen_random_uuid(),
  ordem_servico_id   uuid        not null references pcm.ordens_servico (id) on delete cascade,
  status_anterior    text,
  status_novo        text        not null,
  origem             text        not null default 'pcm',
  metadata           jsonb       not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  created_by         uuid        references auth.users
);

create index if not exists idx_os_status_eventos_os_created
  on pcm.os_status_eventos (ordem_servico_id, created_at desc);

create index if not exists idx_os_status_eventos_status_created
  on pcm.os_status_eventos (status_novo, created_at desc);

alter table pcm.os_status_eventos enable row level security;
alter table pcm.os_status_eventos force row level security;

grant usage on schema pcm to authenticated, service_role;
grant select on pcm.os_status_eventos to authenticated;
grant select, insert, update, delete on pcm.os_status_eventos to service_role;

create policy "os_status_eventos_select" on pcm.os_status_eventos
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create or replace function pcm.fn_registrar_os_status_evento()
returns trigger
language plpgsql
security definer
set search_path = pcm, public
as $$
begin
  if tg_op = 'INSERT' then
    insert into pcm.os_status_eventos (
      ordem_servico_id,
      status_anterior,
      status_novo,
      origem,
      metadata,
      created_by
    )
    values (
      new.id,
      null,
      new.status,
      'criacao',
      jsonb_build_object('numero', new.numero, 'origem_os', new.origem),
      new.created_by
    );
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into pcm.os_status_eventos (
      ordem_servico_id,
      status_anterior,
      status_novo,
      origem,
      metadata,
      created_by
    )
    values (
      new.id,
      old.status,
      new.status,
      'pcm',
      jsonb_build_object(
        'numero', new.numero,
        'auvo_task_id', new.auvo_task_id,
        'auvo_sync_status', new.auvo_sync_status
      ),
      coalesce(new.updated_by, new.created_by)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_os_status_eventos on pcm.ordens_servico;
create trigger trg_os_status_eventos
after insert or update of status on pcm.ordens_servico
for each row execute function pcm.fn_registrar_os_status_evento();

