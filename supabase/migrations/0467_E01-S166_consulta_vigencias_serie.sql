-- ADR-0241: leitura paginada sob o mesmo gate do vínculo.
create function pcm.sso_listar_vigencias_rotina_serie(p_plano_id uuid,p_rotina_id uuid,p_serie_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,inicio date,fim date,revisao integer,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;v_logica uuid;
begin
  if not coalesce((select habilitado from pcm.ocorrencia_rotina_gate where id),false) then raise exception 'materializacao_bloqueada' using errcode='55000'; end if;
  select cliente_id into v_cliente from pcm.planos_manutencao where id=p_plano_id;
  if auth.uid() is null or v_cliente is null or config.sso_autorizar_acao('plano.gerir',v_cliente) is distinct from true
    or config.sso_autorizar_acao('visita.confirmar',v_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'consulta_invalida' using errcode='22023'; end if;
  select r.rotina_logica_id into v_logica from pcm.rotinas_manutencao r where r.id=p_rotina_id and r.plano_id=p_plano_id;
  if not found or not exists(select 1 from pcm.rotina_visita_serie_vinculos vinc join pcm.calendario_contratual_series serie
    on serie.id=vinc.serie_id and serie.cliente_id=v_cliente where vinc.plano_id=p_plano_id and vinc.rotina_logica_id=v_logica and vinc.serie_id=p_serie_id) then
    raise exception 'vinculo_indisponivel' using errcode='42501'; end if;
  return query select v.id,v.inicio,v.fim,v.revisao,v.criado_em from pcm.rotina_serie_vigencias v
    where v.plano_id=p_plano_id and v.rotina_logica_id=v_logica and v.serie_id=p_serie_id and (p_apos is null or v.id>p_apos)
    order by v.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_vigencias_rotina_serie(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_listar_eventos_vigencia_serie(p_plano_id uuid,p_vigencia_id uuid,p_apos integer,p_limite integer)
returns table(id uuid,revisao integer,acao text,motivo text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
  if not coalesce((select habilitado from pcm.ocorrencia_rotina_gate where id),false) then raise exception 'materializacao_bloqueada' using errcode='55000'; end if;
  select cliente_id into v_cliente from pcm.planos_manutencao where id=p_plano_id;
  if auth.uid() is null or v_cliente is null or config.sso_autorizar_acao('plano.gerir',v_cliente) is distinct from true
    or config.sso_autorizar_acao('visita.confirmar',v_cliente) is distinct from true
    or not exists(select 1 from pcm.rotina_serie_vigencias v where v.id=p_vigencia_id and v.plano_id=p_plano_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<0) then raise exception 'consulta_invalida' using errcode='22023'; end if;
  return query select e.id,e.revisao,e.acao,e.motivo,e.ator_id,e.criado_em from pcm.rotina_serie_vigencia_eventos e
    where e.vigencia_id=p_vigencia_id and (p_apos is null or e.revisao>p_apos) order by e.revisao limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_eventos_vigencia_serie(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
