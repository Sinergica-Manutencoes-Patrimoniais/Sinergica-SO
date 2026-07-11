-- 0078_E01-S52_gps_posicoes.sql
-- Reverso: DROP TABLE IF EXISTS pcm.gps_posicoes;

create table if not exists pcm.gps_posicoes (
  id uuid primary key default gen_random_uuid(),
  auvo_user_id bigint not null,
  funcionario_id uuid references pcm.funcionarios(id) on delete set null,
  position_date timestamptz not null,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  battery_level integer,
  network_operator_name text,
  created_at timestamptz not null default now(),
  unique (auvo_user_id, position_date)
);

create index if not exists idx_gps_posicoes_ultima on pcm.gps_posicoes (auvo_user_id, position_date desc);
create index if not exists idx_gps_posicoes_retencao on pcm.gps_posicoes (position_date);

alter table pcm.gps_posicoes enable row level security;
alter table pcm.gps_posicoes force row level security;
grant select on pcm.gps_posicoes to authenticated;
grant select, insert, update, delete on pcm.gps_posicoes to service_role;

create policy "gps_posicoes_select_pcm" on pcm.gps_posicoes for select to authenticated
using (auth.jwt() ->> 'user_role' = 'superadmin' or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita'));

create or replace function pcm.fn_purgar_gps_posicoes()
returns integer language plpgsql security invoker set search_path = pcm, public as $$
declare removidas integer;
begin
  delete from pcm.gps_posicoes where position_date < now() - interval '7 days';
  get diagnostics removidas = row_count;
  return removidas;
end;
$$;

grant execute on function pcm.fn_purgar_gps_posicoes() to service_role;
