-- ADR-0194. Consultas preparadas, gate false, funções revogadas.
create table pcm.sso_resumo_despesa_gate (id boolean primary key default true check (id), habilitado boolean not null default false);
alter table pcm.sso_resumo_despesa_gate enable row level security;
alter table pcm.sso_resumo_despesa_gate force row level security;
revoke all on pcm.sso_resumo_despesa_gate from public, anon, authenticated, service_role;
insert into pcm.sso_resumo_despesa_gate(id, habilitado) values (true, false);

create function pcm.sso_resumo_despesas_visita(p_cliente_id uuid, p_visita_id uuid)
returns table(quantidade bigint, previsto_centavos numeric, realizado_centavos numeric,
  sem_realizado bigint, sem_rateio bigint, rateio_historico bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_previsto numeric; v_realizado numeric;
begin
  if auth.uid() is null or p_cliente_id is null or p_visita_id is null
    or config.sso_autorizar_acao('despesa_visita.gerir', p_cliente_id) is not true
    or not exists (select 1 from pcm.visitas v where v.id = p_visita_id and v.cliente_id = p_cliente_id) then
    raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  if not coalesce((select habilitado from pcm.sso_resumo_despesa_gate where id), false) then
    raise exception 'resumo_indisponivel' using errcode = '55000'; end if;
  select coalesce(sum(d.previsto_centavos), 0), coalesce(sum(d.realizado_centavos), 0)
    into v_previsto, v_realizado from pcm.despesas_visita d
    where d.cliente_id = p_cliente_id and d.visita_id = p_visita_id and d.status = 'ativa';
  if v_previsto > 9007199254740991 or v_realizado > 9007199254740991 then
    raise exception 'total_excede_limite' using errcode = '22003'; end if;
  return query select count(*), v_previsto, v_realizado, count(*) filter (where d.realizado_centavos is null),
    count(*) filter (where not exists (select 1 from pcm.despesa_visita_rateio_parcelas p
      where p.despesa_id = d.id and p.revisao = (select max(r.revisao) from pcm.despesa_visita_rateios r where r.despesa_id = d.id))),
    count(*) filter (where exists (select 1 from pcm.despesa_visita_rateio_parcelas p
      join pcm.visita_ordens_servico vo on vo.id = p.vinculo_id
      where p.despesa_id = d.id and p.revisao = (select max(r.revisao) from pcm.despesa_visita_rateios r where r.despesa_id = d.id)
        and vo.encerrado_em is not null))
    from pcm.despesas_visita d where d.cliente_id = p_cliente_id and d.visita_id = p_visita_id and d.status = 'ativa';
end;
$$;
revoke all on function pcm.sso_resumo_despesas_visita(uuid, uuid) from public, anon, authenticated, service_role;

create function pcm.sso_resumo_despesas_os_visita(p_cliente_id uuid, p_visita_id uuid, p_apos uuid default null)
returns table(os_id uuid, numero text, valor_previsto_nao_realizado_centavos numeric,
  valor_realizado_centavos numeric, despesas_nao_realizadas bigint, vinculos_historicos bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_visita_id is null
    or config.sso_autorizar_acao('despesa_visita.gerir', p_cliente_id) is not true
    or not exists (select 1 from pcm.visitas v where v.id = p_visita_id and v.cliente_id = p_cliente_id) then
    raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  if not coalesce((select habilitado from pcm.sso_resumo_despesa_gate where id), false) then
    raise exception 'resumo_indisponivel' using errcode = '55000'; end if;
  if exists (select 1 from pcm.despesas_visita d
    join lateral (select r.revisao from pcm.despesa_visita_rateios r where r.despesa_id = d.id order by r.revisao desc limit 1) ult on true
    join pcm.despesa_visita_rateio_parcelas p on p.despesa_id = d.id and p.revisao = ult.revisao
    join pcm.visita_ordens_servico vo on vo.id = p.vinculo_id
    where d.cliente_id = p_cliente_id and d.visita_id = p_visita_id and d.status = 'ativa'
    group by vo.os_id having sum(p.valor_centavos) > 9007199254740991) then
    raise exception 'total_excede_limite' using errcode = '22003'; end if;
  return query select os.id, os.numero,
    coalesce(sum(p.valor_centavos) filter (where d.realizado_centavos is null), 0),
    coalesce(sum(p.valor_centavos) filter (where d.realizado_centavos is not null), 0),
    count(distinct d.id) filter (where d.realizado_centavos is null),
    count(distinct vo.id) filter (where vo.encerrado_em is not null)
    from pcm.despesas_visita d
    join lateral (select r.revisao from pcm.despesa_visita_rateios r where r.despesa_id = d.id order by r.revisao desc limit 1) ult on true
    join pcm.despesa_visita_rateio_parcelas p on p.despesa_id = d.id and p.revisao = ult.revisao
    join pcm.visita_ordens_servico vo on vo.id = p.vinculo_id and vo.visita_id = p_visita_id and vo.cliente_id = p_cliente_id
    join pcm.ordens_servico os on os.id = vo.os_id and os.client_id = p_cliente_id
    where d.cliente_id = p_cliente_id and d.visita_id = p_visita_id and d.status = 'ativa'
      and (p_apos is null or os.id > p_apos)
    group by os.id, os.numero order by os.id limit 20;
end;
$$;
revoke all on function pcm.sso_resumo_despesas_os_visita(uuid, uuid, uuid) from public, anon, authenticated, service_role;
