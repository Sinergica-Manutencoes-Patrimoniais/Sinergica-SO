-- ADR-0228: contagens locais; sem saldo ou decisão operacional presumida.
create table pcm.capacidade_horizonte_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.capacidade_horizonte_gate enable row level security;
alter table pcm.capacidade_horizonte_gate force row level security;
revoke all on pcm.capacidade_horizonte_gate from public,anon,authenticated,service_role;
insert into pcm.capacidade_horizonte_gate(id,habilitado) values(true,false);
create function pcm.sso_horizonte_capacidade_preparado(p_cliente_id uuid,p_semana_inicio date,p_quantidade integer)
returns table(semana_inicio date,declaracoes bigint,visitas bigint,disponibilidade_completa boolean,demanda_completa boolean,
  disponibilidade_minutos bigint,demanda_minutos bigint,saldo_minutos bigint)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.capacidade_horizonte_gate where id),false) then raise exception 'horizonte_capacidade_bloqueado' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true then raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if p_semana_inicio is null or not isfinite(p_semana_inicio) or extract(isodow from p_semana_inicio)<>1
    or p_quantidade is null or p_quantidade not between 1 and 12 then raise exception 'periodo_invalido' using errcode='22023'; end if;
  return query select semana.data,
    (select count(*) from pcm.capacidade_disponibilidades d where d.cliente_id=p_cliente_id and d.semana_inicio=semana.data),
    (select count(*) from pcm.visitas v where v.cliente_id=p_cliente_id and v.estado not in ('cancelada','concluida')
      and (v.inicio_em at time zone v.fuso)::date>=semana.data and (v.inicio_em at time zone v.fuso)::date<semana.data+7),
    false,false,null::bigint,null::bigint,null::bigint
    from (select (p_semana_inicio+(n*7))::date as data from pg_catalog.generate_series(0,p_quantidade-1) n) semana order by semana.data;
end;
$$;
revoke all on function pcm.sso_horizonte_capacidade_preparado(uuid,date,integer) from public,anon,authenticated,service_role;
