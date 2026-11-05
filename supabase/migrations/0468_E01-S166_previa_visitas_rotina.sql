-- ADR-0242: candidatos reais, sem gerar dados operacionais.
create function pcm.sso_prever_visitas_rotina(p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_serie_id uuid,p_inicio date,p_fim date,p_apos uuid,p_limite integer)
returns table(visita_id uuid,semana_origem date,vencimento_original date,estado_visita text,feriado_declarado boolean,vigencia_declarada boolean,ocorrencia_preparada boolean)
language plpgsql stable security definer set search_path='' as $$
declare v_plano pcm.planos_manutencao%rowtype;v_rotina pcm.rotinas_manutencao%rowtype;
begin
  if not coalesce((select habilitado from pcm.ocorrencia_rotina_gate where id),false) then raise exception 'materializacao_bloqueada' using errcode='55000'; end if;
  select * into v_plano from pcm.planos_manutencao where id=p_plano_id;
  if auth.uid() is null or not found or config.sso_autorizar_acao('plano.gerir',v_plano.cliente_id) is distinct from true
    or config.sso_autorizar_acao('visita.confirmar',v_plano.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_inicio is null or p_fim is null or not isfinite(p_inicio) or not isfinite(p_fim) or p_fim<p_inicio or p_fim-p_inicio>366
    or p_limite is null or p_limite not between 1 and 100 then raise exception 'consulta_invalida' using errcode='22023'; end if;
  select r.* into v_rotina from pcm.rotinas_manutencao r join pcm.plano_versoes v on v.id=r.versao_id and v.plano_id=r.plano_id and v.estado='aprovado'
    where r.id=p_rotina_id and r.plano_id=p_plano_id and r.versao_id=p_versao_id and r.modo='visita';
  if not found or not exists(select 1 from pcm.rotina_visita_serie_vinculos v join pcm.calendario_contratual_series s on s.id=v.serie_id and s.cliente_id=v_plano.cliente_id
    where v.plano_id=p_plano_id and v.rotina_logica_id=v_rotina.rotina_logica_id and v.serie_id=p_serie_id) then raise exception 'vinculo_indisponivel' using errcode='23514'; end if;
  return query select v.id,o.semana_origem,o.semana_origem+(r.dia_semana-1),v.estado,
    exists(select 1 from pcm.feriados_declarados f where f.cliente_id=v_plano.cliente_id and f.ativo and f.data=o.semana_origem+(r.dia_semana-1)
      and (f.contrato_id is null or f.contrato_id=o.contrato_id)),
    exists(select 1 from pcm.rotina_serie_vigencias g where g.plano_id=p_plano_id and g.rotina_logica_id=v_rotina.rotina_logica_id and g.serie_id=p_serie_id
      and g.inicio<=o.semana_origem+(r.dia_semana-1) and (g.fim is null or g.fim>=o.semana_origem+(r.dia_semana-1))),
    exists(select 1 from pcm.ocorrencias_visita_preparadas oc where oc.plano_id=p_plano_id and oc.rotina_logica_id=v_rotina.rotina_logica_id
      and oc.serie_id=p_serie_id and oc.semana_origem=o.semana_origem)
    from pcm.visita_origem_contratual o join pcm.visitas v on v.id=o.visita_id and v.cliente_id=o.cliente_id
    join pcm.regras_visita_contratual r on r.id=o.regra_id and r.serie_id=o.serie_id
    where o.cliente_id=v_plano.cliente_id and o.serie_id=p_serie_id and v.estado not in ('cancelada','concluida')
      and o.semana_origem+(r.dia_semana-1) between p_inicio and p_fim and (p_apos is null or v.id>p_apos)
    order by v.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_prever_visitas_rotina(uuid,uuid,uuid,uuid,date,date,uuid,integer) from public,anon,authenticated,service_role;
