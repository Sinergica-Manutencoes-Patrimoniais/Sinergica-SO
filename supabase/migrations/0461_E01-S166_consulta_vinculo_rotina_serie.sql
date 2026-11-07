-- ADR-0235: consulta dos vínculos privados, sem materialização.
create function pcm.sso_listar_vinculos_rotina_serie(p_plano_id uuid,p_rotina_id uuid,p_apos uuid,p_limite integer)
returns table(serie_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;v_logica uuid;
begin
  if not coalesce((select habilitado from pcm.ocorrencia_rotina_gate where id),false) then raise exception 'materializacao_bloqueada' using errcode='55000'; end if;
  select cliente_id into v_cliente from pcm.planos_manutencao where id=p_plano_id;
  if auth.uid() is null or v_cliente is null or config.sso_autorizar_acao('plano.gerir',v_cliente) is distinct from true
    or config.sso_autorizar_acao('visita.confirmar',v_cliente) is distinct from true then raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if p_rotina_id is null or p_limite is null or p_limite not between 1 and 100 then
    raise exception 'consulta_invalida' using errcode='22023'; end if;
  select rotina_logica_id into v_logica from pcm.rotinas_manutencao r where r.plano_id=p_plano_id and r.id=p_rotina_id;
  if not found then raise exception 'consulta_invalida' using errcode='22023'; end if;
  return query select vinc.serie_id,vinc.criado_em from pcm.rotina_visita_serie_vinculos vinc
    join pcm.calendario_contratual_series serie on serie.id=vinc.serie_id and serie.cliente_id=v_cliente
    where vinc.plano_id=p_plano_id and vinc.rotina_logica_id=v_logica and (p_apos is null or vinc.serie_id>p_apos)
    order by vinc.serie_id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_vinculos_rotina_serie(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
