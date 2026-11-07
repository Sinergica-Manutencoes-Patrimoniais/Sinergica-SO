-- ADR-0131: leitura preparatória, sem consolidar HH ou liberar API.
create table pcm.capacidade_demanda_gate (
  id boolean primary key default true check (id),
  habilitado boolean not null default false
);
alter table pcm.capacidade_demanda_gate enable row level security;
alter table pcm.capacidade_demanda_gate force row level security;
revoke all on pcm.capacidade_demanda_gate from public, anon, authenticated, service_role;
insert into pcm.capacidade_demanda_gate(id, habilitado) values (true, false);

create function pcm.sso_listar_fontes_demanda_visita(
  p_cliente_id uuid, p_semana_inicio date, p_apos uuid default null, p_limite integer default 50
) returns table (
  vinculo_id uuid, visita_id uuid, os_id uuid, os_status text,
  ocorrencia_legada_id uuid, ocorrencia_preparada_id uuid, ciclo_id uuid,
  inicio_em timestamptz, fuso text, estimativa_os_minutos integer,
  participantes bigint, deslocamento_visita_minutos integer, completude text
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce((select habilitado from pcm.capacidade_demanda_gate where id), false) then
    raise exception 'demanda_capacidade_bloqueada' using errcode = '55000';
  end if;
  if auth.uid() is null or p_cliente_id is null or p_semana_inicio is null
    or not isfinite(p_semana_inicio) or extract(isodow from p_semana_inicio) <> 1
    or p_limite is null or p_limite not between 1 and 100 then
    raise exception 'consulta_invalida' using errcode = '22023';
  end if;
  if config.sso_autorizar_acao('capacidade.gerir', p_cliente_id) is distinct from true then
    raise exception 'capacidade_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;

  return query
  with pagina as materialized (
    select vo.id as vinculo_id, v.id as visita_id, os.id as os_id, os.status::text as os_status,
      os.ocorrencia_preventiva_id, v.inicio_em, v.fuso, vo.estimativa_minutos,
      v.deslocamento_minutos
    from pcm.visita_ordens_servico vo
    join pcm.visitas v on v.id = vo.visita_id and v.cliente_id = vo.cliente_id
    join pcm.ordens_servico os on os.id = vo.os_id and os.client_id = vo.cliente_id
    where vo.cliente_id = p_cliente_id and vo.encerrado_em is null and os.deleted_at is null
      and v.estado not in ('cancelada', 'concluida')
      and (v.inicio_em at time zone v.fuso)::date >= p_semana_inicio
      and (v.inicio_em at time zone v.fuso)::date < p_semana_inicio + 7
      and (p_apos is null or vo.id > p_apos)
    order by vo.id limit p_limite
  ), equipes as (
    select e.visita_id, count(*) as participantes
    from pcm.visita_equipes e
    where e.cliente_id = p_cliente_id and e.encerrado_em is null
      and e.visita_id in (select pagina.visita_id from pagina)
    group by e.visita_id
  )
  select pagina.vinculo_id, pagina.visita_id, pagina.os_id, pagina.os_status,
    pagina.ocorrencia_preventiva_id, vinc.ocorrencia_preparada_id, vinc.ciclo_id,
    pagina.inicio_em, pagina.fuso, pagina.estimativa_minutos,
    coalesce(equipes.participantes, 0::bigint), pagina.deslocamento_minutos, 'desconhecida'::text
  from pagina
  left join equipes on equipes.visita_id = pagina.visita_id
  left join pcm.ocorrencias_rotina_vinculos vinc on vinc.ocorrencia_legada_id = pagina.ocorrencia_preventiva_id
  order by pagina.vinculo_id;
end;
$$;
revoke all on function pcm.sso_listar_fontes_demanda_visita(uuid, date, uuid, integer)
  from public, anon, authenticated, service_role;
