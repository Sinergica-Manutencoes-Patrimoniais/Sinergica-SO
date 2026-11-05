-- ADR-1505: lista exclusiva de Visitas; preserva o contrato de calendário.
create function pcm.sso_listar_fila_visita_cronologica(
 p_cliente_id uuid,p_plano_id uuid,p_estado text,p_inicio date,p_fim date,
 p_apos_vencimento date,p_apos_ciclo uuid,p_limite integer
) returns table(ciclo_id uuid,preparada_id uuid,estado text,revisao integer,vencimento date,
 atualizado_em timestamptz,rotina_id uuid,rotina_nome text,alvo_tipo text,alvo_id uuid,versao_origem_id uuid,visita_id uuid)
 language plpgsql volatile security definer set search_path='' as $$
begin
 if auth.uid() is null or p_cliente_id is null or p_plano_id is null or p_limite is null or p_limite not between 1 and 50
  or (p_estado is not null and p_estado not in ('aguardando','verificacao','cancelado'))
  or (p_inicio is not null and not isfinite(p_inicio)) or (p_fim is not null and not isfinite(p_fim))
  or (p_inicio is not null and p_fim is not null and p_inicio>p_fim)
  or ((p_apos_vencimento is null)<>(p_apos_ciclo is null))
  or (p_apos_vencimento is not null and not isfinite(p_apos_vencimento)) then raise exception 'consulta_invalida' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_fila_visita_gate where id and habilitado for share;
 if not found then raise exception 'fila_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true
  or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true
  or not exists(select 1 from pcm.planos_manutencao p where p.id=p_plano_id and p.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select f.ciclo_id,f.preparada_id,f.estado,f.revisao,o.vencimento_original,f.atualizado_em,
  o.rotina_id,r.nome,o.alvo_tipo,o.alvo_id,o.versao_id,o.visita_id
 from pcm.sso_fila_visita f join pcm.ocorrencias_visita_preparadas o on o.id=f.preparada_id and o.plano_id=f.plano_id
 join pcm.sso_ciclo_visita_versoes cv on cv.preparada_id=o.id and cv.ciclo_id=f.ciclo_id and cv.versao_id=o.versao_id
 join pcm.sso_ciclos_visita_canonicos c on c.id=f.ciclo_id and c.plano_id=f.plano_id
  and c.rotina_logica_id=o.rotina_logica_id and c.alvo_tipo=o.alvo_tipo and c.alvo_id=o.alvo_id and c.serie_id=o.serie_id and c.semana_origem=o.semana_origem
 left join pcm.rotinas_manutencao r on r.id=o.rotina_id and r.plano_id=o.plano_id and r.versao_id=o.versao_id
 where f.cliente_id=p_cliente_id and f.plano_id=p_plano_id and (p_estado is null or f.estado=p_estado)
  and (p_inicio is null or o.vencimento_original>=p_inicio) and (p_fim is null or o.vencimento_original<=p_fim)
  and (p_apos_vencimento is null or (o.vencimento_original,f.ciclo_id)>(p_apos_vencimento,p_apos_ciclo))
 order by o.vencimento_original,f.ciclo_id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_fila_visita_cronologica(uuid,uuid,text,date,date,date,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_fila_visita_cronologica(uuid,uuid,text,date,date,date,uuid,integer) to authenticated;
