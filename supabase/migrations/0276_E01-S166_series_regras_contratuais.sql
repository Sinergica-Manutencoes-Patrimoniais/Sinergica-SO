-- ADR-0053: fundação aditiva, sem comandos ou geração operacional.
create extension if not exists btree_gist with schema extensions;
alter table comercial.contratos add constraint contratos_id_cliente_s166_unique unique (id, cliente_id);

create table pcm.calendario_contratual_series (
  id uuid primary key,
  cliente_id uuid not null references pcm.clientes(id),
  contrato_id uuid not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (contrato_id, cliente_id) references comercial.contratos(id, cliente_id)
);
create index idx_calendario_contratual_cliente on pcm.calendario_contratual_series(cliente_id, id);
alter table pcm.calendario_contratual_series enable row level security;
alter table pcm.calendario_contratual_series force row level security;
revoke all on pcm.calendario_contratual_series from public, anon, authenticated, service_role;
grant select on pcm.calendario_contratual_series to authenticated;
create policy calendario_series_gestor_read on pcm.calendario_contratual_series for select to authenticated
  using (config.sso_autorizar_acao('plano.gerir', cliente_id));

create table pcm.regras_visita_contratual (
  id uuid primary key,
  serie_id uuid not null references pcm.calendario_contratual_series(id),
  numero integer not null check (numero > 0),
  ancora_semana date not null check (extract(isodow from ancora_semana) = 1),
  dia_semana integer not null check (dia_semana between 1 and 7),
  intervalo_semanas integer not null check (intervalo_semanas > 0),
  hora_inicio time not null,
  duracao_minutos integer not null check (duracao_minutos > 0),
  deslocamento_minutos integer not null default 0 check (deslocamento_minutos >= 0),
  fuso text not null,
  vigencia_inicio date not null,
  vigencia_fim date,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (serie_id, numero),
  check (vigencia_fim is null or vigencia_fim >= vigencia_inicio),
  exclude using gist (serie_id extensions.gist_uuid_ops with =, daterange(vigencia_inicio, vigencia_fim, '[]') with &&)
);
create index idx_regras_visita_serie on pcm.regras_visita_contratual(serie_id, id);
alter table pcm.regras_visita_contratual enable row level security;
alter table pcm.regras_visita_contratual force row level security;
revoke all on pcm.regras_visita_contratual from public, anon, authenticated, service_role;
grant select on pcm.regras_visita_contratual to authenticated;
create policy regras_visita_gestor_read on pcm.regras_visita_contratual for select to authenticated
  using (exists(select 1 from pcm.calendario_contratual_series s where s.id = serie_id
    and config.sso_autorizar_acao('plano.gerir', s.cliente_id)));

create function pcm.sso_validar_fuso_regra_visita() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists(select 1 from pg_catalog.pg_timezone_names t where t.name = new.fuso) then
    raise exception 'fuso_invalido' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_validar_fuso_regra_visita() from public, anon, authenticated, service_role;
create trigger sso_validar_fuso_regra before insert on pcm.regras_visita_contratual
for each row execute function pcm.sso_validar_fuso_regra_visita();

create function pcm.sso_proteger_regra_visita() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'regra_historica_imutavel' using errcode = '23514'; end if;
  if (to_jsonb(new) - 'vigencia_fim') is distinct from (to_jsonb(old) - 'vigencia_fim') then
    raise exception 'regra_historica_imutavel' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_proteger_regra_visita() from public, anon, authenticated, service_role;
create trigger sso_proteger_regra before update or delete on pcm.regras_visita_contratual
for each row execute function pcm.sso_proteger_regra_visita();
