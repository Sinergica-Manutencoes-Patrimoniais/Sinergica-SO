-- 0019_E01-S19_inspecoes_laudos_spda.sql — Sinérgica SO
-- Story E01-S19. Fundação operacional de Inspeções e Laudos SPDA no PCM.

create table if not exists pcm.inspecoes (
  id                    uuid        primary key default gen_random_uuid(),
  client_id             uuid        not null references pcm.clientes,
  titulo                text        not null,
  data_inspecao         date        not null default current_date,
  responsavel_tecnico   text,
  status                text        not null default 'rascunho'
                                      check (status in ('rascunho', 'em_andamento', 'concluida', 'backlog_gerado')),
  observacoes_gerais    text,
  total_itens           int         not null default 0,
  itens_conformes       int         not null default 0,
  itens_nao_conformes   int         not null default 0,
  itens_atencao         int         not null default 0,
  created_at            timestamptz not null default now(),
  created_by            uuid        not null references auth.users,
  updated_at            timestamptz,
  updated_by            uuid        references auth.users,
  deleted_at            timestamptz
);

create table if not exists pcm.inspecao_itens (
  id                    uuid        primary key default gen_random_uuid(),
  inspecao_id           uuid        not null references pcm.inspecoes on delete cascade,
  client_id             uuid        not null references pcm.clientes,
  sistema               text        not null check (
                                      sistema in (
                                        'estrutural', 'hidrossanitario', 'eletrico', 'spda',
                                        'cobertura', 'fachada', 'areas_comuns', 'equipamentos',
                                        'incendio', 'ar_condicionado', 'elevadores', 'geral'
                                      )
                                    ),
  localizacao           text,
  descricao             text        not null,
  resultado             text        not null default 'nao_avaliado'
                                      check (resultado in ('conforme', 'nao_conforme', 'atencao', 'nao_avaliado')),
  severidade            text        not null default 'media'
                                      check (severidade in ('baixa', 'media', 'alta', 'critica')),
  recomendacao          text,
  prazo_recomendado     date,
  foto_url              text,
  auvo_task_id          bigint,
  ordem                 int         not null default 0,
  created_at            timestamptz not null default now(),
  created_by            uuid        not null references auth.users,
  updated_at            timestamptz,
  updated_by            uuid        references auth.users
);

create table if not exists pcm.laudos_spda (
  id                    uuid        primary key default gen_random_uuid(),
  client_id             uuid        not null references pcm.clientes,
  numero                text        not null unique,
  status                text        not null default 'rascunho'
                                      check (status in ('rascunho', 'em_andamento', 'concluido', 'assinado')),
  data_vistoria         date        not null default current_date,
  arte_numero           text,
  responsavel_tecnico   text,
  notas_gerais          text,
  conclusao             text,
  nivel_protecao        text        check (nivel_protecao in ('I', 'II', 'III', 'IV')),
  necessita_spda        boolean,
  risco_total           numeric,
  dados                 jsonb       not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  created_by            uuid        not null references auth.users,
  updated_at            timestamptz,
  updated_by            uuid        references auth.users,
  deleted_at            timestamptz
);

create table if not exists pcm.laudo_spda_pontos (
  id                    uuid        primary key default gen_random_uuid(),
  laudo_id              uuid        not null references pcm.laudos_spda on delete cascade,
  numero_ponto          int         not null,
  localizacao           text        not null,
  resistencia_ohm       numeric,
  status_conformidade   text        not null default 'pendente'
                                      check (status_conformidade in ('conforme', 'nao_conforme', 'atencao', 'pendente')),
  observacoes           text,
  foto_url              text,
  created_at            timestamptz not null default now(),
  created_by            uuid        not null references auth.users,
  updated_at            timestamptz,
  updated_by            uuid        references auth.users,
  unique (laudo_id, numero_ponto)
);

create index if not exists idx_inspecoes_client_date
  on pcm.inspecoes (client_id, data_inspecao desc);
create index if not exists idx_inspecoes_status
  on pcm.inspecoes (status);
create index if not exists idx_inspecao_itens_inspecao
  on pcm.inspecao_itens (inspecao_id, ordem, created_at);
create index if not exists idx_laudos_spda_client_date
  on pcm.laudos_spda (client_id, data_vistoria desc);
create index if not exists idx_laudos_spda_status
  on pcm.laudos_spda (status);
create index if not exists idx_laudo_spda_pontos_laudo
  on pcm.laudo_spda_pontos (laudo_id, numero_ponto);

alter table pcm.inspecoes          enable row level security;
alter table pcm.inspecoes          force row level security;
alter table pcm.inspecao_itens     enable row level security;
alter table pcm.inspecao_itens     force row level security;
alter table pcm.laudos_spda        enable row level security;
alter table pcm.laudos_spda        force row level security;
alter table pcm.laudo_spda_pontos  enable row level security;
alter table pcm.laudo_spda_pontos  force row level security;

grant usage on schema pcm to authenticated, service_role;
grant select, insert, update on
  pcm.inspecoes,
  pcm.inspecao_itens,
  pcm.laudos_spda,
  pcm.laudo_spda_pontos
to authenticated;
grant select, insert, update, delete on
  pcm.inspecoes,
  pcm.inspecao_itens,
  pcm.laudos_spda,
  pcm.laudo_spda_pontos
to service_role;

create policy "inspecoes_select" on pcm.inspecoes
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "inspecoes_insert" on pcm.inspecoes
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "inspecoes_update" on pcm.inspecoes
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "inspecao_itens_select" on pcm.inspecao_itens
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "inspecao_itens_insert" on pcm.inspecao_itens
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "inspecao_itens_update" on pcm.inspecao_itens
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "laudos_spda_select" on pcm.laudos_spda
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "laudos_spda_insert" on pcm.laudos_spda
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "laudos_spda_update" on pcm.laudos_spda
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "laudo_spda_pontos_select" on pcm.laudo_spda_pontos
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "laudo_spda_pontos_insert" on pcm.laudo_spda_pontos
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "laudo_spda_pontos_update" on pcm.laudo_spda_pontos
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create or replace function pcm.fn_recalcular_totais_inspecao(p_inspecao_id uuid)
returns void
language sql
security definer
set search_path = pcm, public
as $$
  update pcm.inspecoes i
  set
    total_itens = coalesce(t.total, 0),
    itens_conformes = coalesce(t.conformes, 0),
    itens_nao_conformes = coalesce(t.nao_conformes, 0),
    itens_atencao = coalesce(t.atencao, 0),
    updated_at = now()
  from (
    select
      count(*)::int as total,
      count(*) filter (where resultado = 'conforme')::int as conformes,
      count(*) filter (where resultado = 'nao_conforme')::int as nao_conformes,
      count(*) filter (where resultado = 'atencao')::int as atencao
    from pcm.inspecao_itens
    where inspecao_id = p_inspecao_id
  ) t
  where i.id = p_inspecao_id;
$$;

create or replace function pcm.trg_recalcular_totais_inspecao()
returns trigger
language plpgsql
security definer
set search_path = pcm, public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform pcm.fn_recalcular_totais_inspecao(new.inspecao_id);
    return new;
  end if;

  perform pcm.fn_recalcular_totais_inspecao(old.inspecao_id);
  return old;
end;
$$;

drop trigger if exists recalcular_totais_inspecao on pcm.inspecao_itens;
create trigger recalcular_totais_inspecao
after insert or update or delete on pcm.inspecao_itens
for each row execute function pcm.trg_recalcular_totais_inspecao();

