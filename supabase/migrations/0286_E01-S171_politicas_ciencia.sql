-- ADR-0062: resolução isolada, sem confirmar Visita ou liberar integração.
create table pcm.politicas_ciencia_visita (
  id uuid primary key,
  cliente_id uuid not null references pcm.clientes(id),
  contrato_id uuid,
  visita_id uuid,
  modo text not null check (modo in ('sem_controle', 'informativa', 'obrigatoria')),
  revisao integer not null default 1 check (revisao > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  foreign key (contrato_id, cliente_id) references comercial.contratos(id, cliente_id),
  foreign key (visita_id, cliente_id) references pcm.visitas(id, cliente_id),
  check (contrato_id is null or visita_id is null),
  unique nulls not distinct (cliente_id, contrato_id, visita_id)
);
alter table pcm.politicas_ciencia_visita enable row level security;
alter table pcm.politicas_ciencia_visita force row level security;
revoke all on pcm.politicas_ciencia_visita from public, anon, authenticated, service_role;
grant select on pcm.politicas_ciencia_visita to authenticated;
create policy politica_ciencia_leitura on pcm.politicas_ciencia_visita for select to authenticated
  using (config.sso_autorizar_acao('visita.confirmar', cliente_id));

create function pcm.sso_resolver_ciencia_visita(p_visita_id uuid)
returns table(modo text, origem text, politica_id uuid, politica_revisao integer)
language plpgsql stable security definer set search_path = '' as $$
declare v_visita pcm.visitas%rowtype; v_politica pcm.politicas_ciencia_visita%rowtype;
begin
  if p_visita_id is null then raise exception 'consulta_invalida' using errcode = '22023'; end if;
  select * into v_visita from pcm.visitas where id = p_visita_id;
  if not found or not config.sso_autorizar_acao('visita.confirmar', v_visita.cliente_id) then
    raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  select p.* into v_politica from pcm.politicas_ciencia_visita p
  where p.cliente_id = v_visita.cliente_id and (
    p.visita_id = v_visita.id or (p.visita_id is null and p.contrato_id = v_visita.contrato_id and v_visita.contrato_id is not null)
    or (p.visita_id is null and p.contrato_id is null))
  order by case when p.visita_id is not null then 1 when p.contrato_id is not null then 2 else 3 end limit 1;
  if not found then return query select 'sem_controle'::text, 'padrao'::text, null::uuid, null::integer; return; end if;
  return query select v_politica.modo,
    case when v_politica.visita_id is not null then 'visita' when v_politica.contrato_id is not null then 'contrato' else 'cliente' end,
    v_politica.id, v_politica.revisao;
end;
$$;
revoke all on function pcm.sso_resolver_ciencia_visita(uuid) from public, anon;
grant execute on function pcm.sso_resolver_ciencia_visita(uuid) to authenticated;
