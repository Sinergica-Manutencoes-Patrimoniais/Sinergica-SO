-- ADR-0778: projeção parcial sem soma, gate de esforço e de fontes permanecem obrigatórios.
create function pcm.sso_mediar_fontes_esforco_visita(p_cliente_id uuid,p_semana_inicio date,p_apos uuid default null,p_limite integer default 50)
returns table(vinculo_id uuid,visita_id uuid,os_id uuid,os_status text,ocorrencia_legada_id uuid,ocorrencia_preparada_id uuid,ciclo_id uuid,
  inicio_em timestamptz,fuso text,estimativa_os_minutos integer,participantes bigint,deslocamento_visita_minutos integer,completude text,
  esforco_revision integer,internos_minutos integer,terceiros_minutos integer,acompanhamento_minutos integer)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.capacidade_esforco_declarado_gate where id),false) then
    raise exception 'esforco_capacidade_bloqueado' using errcode='55000';
  end if;
  return query select f.*,coalesce(d.revisao,0),d.internos_minutos,d.terceiros_minutos,d.acompanhamento_minutos
    from pcm.sso_mediar_fontes_demanda_visita(p_cliente_id,p_semana_inicio,p_apos,p_limite) f
    left join lateral (select e.revisao,e.internos_minutos,e.terceiros_minutos,e.acompanhamento_minutos
      from pcm.capacidade_esforco_declaracoes e where e.cliente_id=p_cliente_id and e.os_id=f.os_id
      order by e.revisao desc limit 1) d on true
    order by f.vinculo_id;
end; $$;
revoke all on function pcm.sso_mediar_fontes_esforco_visita(uuid,date,uuid,integer) from public,anon,service_role;
grant execute on function pcm.sso_mediar_fontes_esforco_visita(uuid,date,uuid,integer) to authenticated;
