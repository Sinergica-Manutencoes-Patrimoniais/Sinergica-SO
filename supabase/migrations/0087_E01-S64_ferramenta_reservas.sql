-- 0087_E01-S64_ferramenta_reservas.sql — Sinérgica SO
-- Feedback Fabrício (2026-07-13): "opção de reserva para uma data, período". Reserva não move a
-- unidade fisicamente — só bloqueia que outra reserva/atribuição conflite no mesmo intervalo. No
-- dia, o escritório efetiva (vira atribuição real, E01-S63 AC-2) ou cancela. Depende de
-- `pcm.ferramenta_unidades` (E01-S63, migration 0086).
--
-- Reverso:
--   drop trigger if exists trg_ferramenta_reservas_validar on pcm.ferramenta_reservas;
--   drop function if exists pcm.fn_validar_reserva_ferramenta();
--   drop table if exists pcm.ferramenta_reservas;

create table if not exists pcm.ferramenta_reservas (
  id                  uuid        primary key default gen_random_uuid(),
  ferramenta_id       uuid        not null references pcm.ferramentas on delete cascade,
  -- null = reserva "genérica" (qualquer unidade disponível desta ferramenta) — AC-1.
  unidade_id          uuid        references pcm.ferramenta_unidades on delete cascade,
  funcionario_id      uuid        not null references pcm.funcionarios,
  data_inicio         date        not null,
  data_fim            date        not null,
  status              text        not null default 'pendente'
                        check (status in ('pendente', 'efetivada', 'cancelada')),
  motivo_cancelamento text,
  created_at          timestamptz not null default now(),
  created_by          uuid        references auth.users,
  updated_at          timestamptz not null default now(),
  updated_by          uuid        references auth.users,
  constraint ferramenta_reservas_periodo_valido check (data_fim >= data_inicio)
);

create index if not exists idx_ferramenta_reservas_ferramenta
  on pcm.ferramenta_reservas (ferramenta_id, data_inicio);
create index if not exists idx_ferramenta_reservas_unidade
  on pcm.ferramenta_reservas (unidade_id)
  where unidade_id is not null;
create index if not exists idx_ferramenta_reservas_status_data
  on pcm.ferramenta_reservas (status, data_inicio);

alter table pcm.ferramenta_reservas enable row level security;
alter table pcm.ferramenta_reservas force row level security;

grant select, insert, update on pcm.ferramenta_reservas to authenticated;
grant select, insert, update, delete on pcm.ferramenta_reservas to service_role;

create policy "ferramenta_reservas_select" on pcm.ferramenta_reservas
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "ferramenta_reservas_insert" on pcm.ferramenta_reservas
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "ferramenta_reservas_update" on pcm.ferramenta_reservas
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

-- AC-2: rejeita conflito de intervalo pra reserva de UNIDADE ESPECÍFICA (defesa em profundidade —
-- a validação "pior caso" de reserva genérica, que precisa contar unidades ativas da ferramenta
-- inteira, fica no domínio do app: `domain/ferramenta-reservas.ts`).
create or replace function pcm.fn_validar_reserva_ferramenta()
returns trigger
language plpgsql
security definer
set search_path = pcm, public
as $$
declare
  v_conflito record;
begin
  if new.status <> 'pendente' or new.unidade_id is null then
    return new;
  end if;

  select r.data_inicio, r.data_fim, f.nome as funcionario_nome
  into v_conflito
  from pcm.ferramenta_reservas r
  join pcm.funcionarios f on f.id = r.funcionario_id
  where r.unidade_id = new.unidade_id
    and r.status = 'pendente'
    and r.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    and r.data_inicio <= new.data_fim
    and r.data_fim >= new.data_inicio
  limit 1;

  if found then
    raise exception 'Unidade já reservada por % de % a % — conflito de intervalo', v_conflito.funcionario_nome, v_conflito.data_inicio, v_conflito.data_fim;
  end if;

  return new;
end;
$$;

create trigger trg_ferramenta_reservas_validar
before insert or update on pcm.ferramenta_reservas
for each row execute function pcm.fn_validar_reserva_ferramenta();
