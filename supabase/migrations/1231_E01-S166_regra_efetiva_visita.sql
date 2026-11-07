-- ADR-1080: histórico privado da regra efetiva, sem alterar a origem da Visita.
create table pcm.sso_visita_regra_transicoes (
  visita_id uuid not null references pcm.visita_origem_contratual(visita_id),
  revisao_visita integer not null check(revisao_visita > 1),
  serie_id uuid not null,
  regra_anterior_id uuid not null,
  regra_nova_id uuid not null,
  inicio_anterior timestamptz not null check(isfinite(inicio_anterior)),
  fim_anterior timestamptz not null check(isfinite(fim_anterior)),
  inicio_novo timestamptz not null check(isfinite(inicio_novo)),
  fim_novo timestamptz not null check(isfinite(fim_novo)),
  request_id uuid not null,
  ator_id uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  primary key(visita_id,revisao_visita),
  unique(request_id,visita_id),
  foreign key(regra_anterior_id,serie_id) references pcm.regras_visita_contratual(id,serie_id),
  foreign key(regra_nova_id,serie_id) references pcm.regras_visita_contratual(id,serie_id),
  check(regra_anterior_id <> regra_nova_id),
  check(fim_anterior > inicio_anterior and fim_novo > inicio_novo)
);
alter table pcm.sso_visita_regra_transicoes enable row level security;
alter table pcm.sso_visita_regra_transicoes force row level security;
revoke all on pcm.sso_visita_regra_transicoes from public,anon,authenticated,service_role;

create function pcm.sso_guardar_regra_efetiva_visita() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_serie uuid;v_regra uuid;v_revisao integer;
begin
  if tg_op <> 'INSERT' then raise exception 'historico_regra_visita_imutavel' using errcode='23514'; end if;
  select o.serie_id,o.regra_id into v_serie,v_regra from pcm.visita_origem_contratual o where o.visita_id=new.visita_id;
  if v_serie is distinct from new.serie_id then raise exception 'origem_incompativel' using errcode='23514'; end if;
  select t.regra_nova_id,t.revisao_visita into v_regra,v_revisao from pcm.sso_visita_regra_transicoes t
    where t.visita_id=new.visita_id order by t.revisao_visita desc limit 1;
  if not found then
    select o.regra_id into v_regra from pcm.visita_origem_contratual o where o.visita_id=new.visita_id;
  end if;
  if v_regra is distinct from new.regra_anterior_id or (v_revisao is not null and new.revisao_visita<=v_revisao)
    then raise exception 'regra_ou_revisao_incompativel' using errcode='23514'; end if;
  return new;
end; $$;
revoke all on function pcm.sso_guardar_regra_efetiva_visita() from public,anon,authenticated,service_role;
create trigger sso_visita_regra_transicoes_guardar before insert or update or delete on pcm.sso_visita_regra_transicoes
for each row execute function pcm.sso_guardar_regra_efetiva_visita();

create function pcm.sso_regra_efetiva_visita(p_visita_id uuid)
returns uuid language sql stable security definer set search_path='' as $$
  select coalesce((select t.regra_nova_id from pcm.sso_visita_regra_transicoes t
      where t.visita_id=o.visita_id order by t.revisao_visita desc limit 1),o.regra_id)
    from pcm.visita_origem_contratual o where o.visita_id=p_visita_id
$$;
revoke all on function pcm.sso_regra_efetiva_visita(uuid) from public,anon,authenticated,service_role;
