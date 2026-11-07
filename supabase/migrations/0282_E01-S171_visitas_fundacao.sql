-- ADR-0058: fundação aditiva, sem comando ou sincronização externa.
alter table pcm.ordens_servico add constraint os_id_cliente_s171_unique unique (id, client_id);
alter table pcm.areas add constraint areas_id_cliente_s171_unique unique (id, cliente_id);

create table pcm.visitas (
  id uuid primary key,
  cliente_id uuid not null references pcm.clientes(id),
  contrato_id uuid,
  area_id uuid,
  local_id uuid references pcm.locais(id),
  inicio_em timestamptz not null check (isfinite(inicio_em)),
  fim_em timestamptz not null check (isfinite(fim_em)),
  fuso text not null,
  natureza text not null check (natureza in ('regular', 'extra', 'reposicao_manual')),
  estado text not null default 'rascunho' check (estado in ('rascunho', 'planejada', 'confirmada', 'enviada', 'em_execucao', 'parcial', 'concluida', 'reprogramada', 'cancelada')),
  responsavel_id uuid references pcm.funcionarios(id),
  deslocamento_minutos integer not null default 0 check (deslocamento_minutos >= 0),
  revisao integer not null default 1 check (revisao > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (id, cliente_id),
  foreign key (contrato_id, cliente_id) references comercial.contratos(id, cliente_id),
  foreign key (area_id, cliente_id) references pcm.areas(id, cliente_id),
  check (fim_em > inicio_em),
  check (local_id is null or area_id is not null)
);
create index idx_visitas_cliente_inicio on pcm.visitas(cliente_id, inicio_em, id);
create index idx_visitas_local on pcm.visitas(local_id) where local_id is not null;
alter table pcm.visitas enable row level security;
alter table pcm.visitas force row level security;
revoke all on pcm.visitas from public, anon, authenticated, service_role;
grant select on pcm.visitas to authenticated;
create policy visitas_leitura_capacidade on pcm.visitas for select to authenticated
  using (config.sso_autorizar_acao('visita.confirmar', cliente_id));

create table pcm.visita_ordens_servico (
  id uuid primary key,
  visita_id uuid not null,
  os_id uuid not null,
  cliente_id uuid not null references pcm.clientes(id),
  sequencia integer not null check (sequencia > 0),
  estimativa_minutos integer check (estimativa_minutos is null or estimativa_minutos >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  encerrado_em timestamptz,
  encerrado_por uuid references auth.users(id),
  encerramento_motivo text,
  foreign key (visita_id, cliente_id) references pcm.visitas(id, cliente_id),
  foreign key (os_id, cliente_id) references pcm.ordens_servico(id, client_id),
  check ((encerrado_em is null and encerrado_por is null and encerramento_motivo is null)
    or (encerrado_em is not null and encerrado_por is not null and nullif(btrim(encerramento_motivo), '') is not null)),
  check (encerrado_em is null or encerrado_em >= created_at)
);
create unique index uq_visita_os_vigente on pcm.visita_ordens_servico(os_id) where encerrado_em is null;
create index idx_visita_os_visita on pcm.visita_ordens_servico(visita_id, id);
alter table pcm.visita_ordens_servico enable row level security;
alter table pcm.visita_ordens_servico force row level security;
revoke all on pcm.visita_ordens_servico from public, anon, authenticated, service_role;
grant select on pcm.visita_ordens_servico to authenticated;
create policy visita_os_leitura_capacidade on pcm.visita_ordens_servico for select to authenticated
  using (config.sso_autorizar_acao('visita.confirmar', cliente_id));

create function pcm.sso_validar_posicao_visita() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names t where t.name = new.fuso) then
    raise exception 'fuso_invalido' using errcode = '22023';
  end if;
  if new.local_id is not null then
    perform l.id from pcm.locais l join pcm.areas a on a.id = l.area_id
    where l.id = new.local_id and l.area_id = new.area_id and a.cliente_id = new.cliente_id
      and l.deleted_at is null and a.deleted_at is null for share of l, a;
    if not found then raise exception 'posicao_invalida_ou_de_outro_cliente' using errcode = '23514'; end if;
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_validar_posicao_visita() from public, anon, authenticated, service_role;
create trigger sso_visita_posicao before insert or update of area_id, local_id, cliente_id, fuso on pcm.visitas
for each row execute function pcm.sso_validar_posicao_visita();

create function pcm.sso_proteger_identidade_visita() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' or new.id is distinct from old.id or new.cliente_id is distinct from old.cliente_id
    or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'identidade_visita_imutavel' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_proteger_identidade_visita() from public, anon, authenticated, service_role;
create trigger sso_visita_identidade before update or delete on pcm.visitas
for each row execute function pcm.sso_proteger_identidade_visita();

create function pcm.sso_proteger_historico_visita_os() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'vinculo_visita_imutavel' using errcode = '23514'; end if;
  if old.encerrado_em is not null or new.encerrado_em is null
    or (to_jsonb(new) - array['encerrado_em', 'encerrado_por', 'encerramento_motivo'])
       is distinct from (to_jsonb(old) - array['encerrado_em', 'encerrado_por', 'encerramento_motivo']) then
    raise exception 'vinculo_visita_imutavel' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_proteger_historico_visita_os() from public, anon, authenticated, service_role;
create trigger sso_visita_os_historico before update or delete on pcm.visita_ordens_servico
for each row execute function pcm.sso_proteger_historico_visita_os();

create function pcm.sso_proteger_cliente_local_visita() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_cliente uuid;
begin
  select cliente_id into v_cliente from pcm.areas where id = new.area_id for share;
  if exists(select 1 from pcm.visitas v where v.local_id = old.id and v.cliente_id is distinct from v_cliente) then
    raise exception 'local_com_visita_de_outro_cliente' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_proteger_cliente_local_visita() from public, anon, authenticated, service_role;
create trigger zzz_local_cliente_visita before update of area_id on pcm.locais
for each row when (old.area_id is distinct from new.area_id) execute function pcm.sso_proteger_cliente_local_visita();

create function pcm.sso_proteger_cliente_area_visita() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from pcm.locais l join pcm.visitas v on v.local_id = l.id
    where l.area_id = old.id and v.cliente_id is distinct from new.cliente_id) then
    raise exception 'area_com_visita_de_outro_cliente' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_proteger_cliente_area_visita() from public, anon, authenticated, service_role;
create trigger zzz_area_cliente_visita before update of cliente_id on pcm.areas
for each row when (old.cliente_id is distinct from new.cliente_id) execute function pcm.sso_proteger_cliente_area_visita();
