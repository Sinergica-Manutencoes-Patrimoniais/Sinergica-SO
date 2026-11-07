-- ADR-0091: vínculo aditivo de origem, sem comandos, backfill ou geração.
-- Adoção operacional, reconciliação e correção auditada permanecem bloqueadas.
alter table pcm.calendario_contratual_series
  add constraint calendario_series_origem_s166_unique unique (id, cliente_id, contrato_id);
alter table pcm.regras_visita_contratual
  add constraint regras_origem_s166_unique unique (id, serie_id);
alter table pcm.visitas
  add constraint visitas_origem_s166_unique unique (id, cliente_id, contrato_id, natureza);

create table pcm.visita_origem_contratual (
  visita_id uuid primary key,
  cliente_id uuid not null,
  contrato_id uuid not null,
  serie_id uuid not null,
  regra_id uuid not null,
  semana_origem date not null check (isfinite(semana_origem) and extract(isodow from semana_origem) = 1),
  natureza text not null default 'regular' check (natureza = 'regular'),
  registrado_por uuid not null references auth.users(id),
  registrado_em timestamptz not null default now(),
  foreign key (visita_id, cliente_id, contrato_id, natureza)
    references pcm.visitas(id, cliente_id, contrato_id, natureza),
  foreign key (serie_id, cliente_id, contrato_id)
    references pcm.calendario_contratual_series(id, cliente_id, contrato_id),
  foreign key (regra_id, serie_id)
    references pcm.regras_visita_contratual(id, serie_id)
);
create index idx_visita_origem_serie_semana on pcm.visita_origem_contratual(serie_id, semana_origem);
alter table pcm.visita_origem_contratual enable row level security;
alter table pcm.visita_origem_contratual force row level security;
revoke all on pcm.visita_origem_contratual from public, anon, authenticated, service_role;
grant select on pcm.visita_origem_contratual to authenticated;
create policy origem_visita_leitura on pcm.visita_origem_contratual for select to authenticated
  using (config.sso_autorizar_acao('plano.gerir', cliente_id)
     and config.sso_autorizar_acao('visita.confirmar', cliente_id));

create function pcm.sso_proteger_origem_visita_contratual() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'origem_visita_historica_imutavel' using errcode = '23514';
end;
$$;
revoke all on function pcm.sso_proteger_origem_visita_contratual() from public, anon, authenticated, service_role;
create trigger sso_origem_visita_historica before update or delete on pcm.visita_origem_contratual
for each row execute function pcm.sso_proteger_origem_visita_contratual();
