-- ADR-0553: fontes de Visita e legado observadas sem afirmar cobertura integral.
create function pcm.sso_avaliar_fontes_impacto_visita_legado(p_cliente_id uuid,p_plano_id uuid,p_expected_plano integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_previa jsonb;v_origem uuid;v_visitas integer;v_visitas_sem_ponte integer;v_relacoes integer;v_legados_sem_relacao integer;v_legadas integer;v_legadas_sem_ponte integer;
begin
 if not coalesce((select habilitado from pcm.sso_avaliacao_impacto_revisao_gate where id),false) or not coalesce((select habilitado from pcm.sso_decisao_impacto_revisao_gate where id),false) then raise exception 'avaliacao_impacto_bloqueada' using errcode='55000';end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501';end if;
 v_previa:=pcm.sso_previa_revisao_revisionada(p_plano_id,p_expected_plano,1,null);v_origem:=(v_previa->>'versaoAnteriorId')::uuid;
 select count(*),count(*) filter(where not exists(select 1 from pcm.sso_vinculos_visita_legado v where v.ocorrencia_visita_id=o.id)) into v_visitas,v_visitas_sem_ponte from pcm.ocorrencias_visita_preparadas o where o.plano_id=p_plano_id and o.versao_id=v_origem;
 with relacoes as (select distinct on (d.plano_legado_id) d.plano_legado_id,d.decisao from pcm.sso_declaracoes_planos_legados d where d.plano_id=p_plano_id and d.cliente_id=p_cliente_id order by d.plano_legado_id,d.revisao desc),
 declaradas as (select r.plano_legado_id from relacoes r join pcm.planos_preventivos p on p.id=r.plano_legado_id and p.cliente_id=p_cliente_id where r.decisao='declarar')
 select (select count(*) from declaradas),
 (select count(*) from pcm.planos_preventivos p where p.cliente_id=p_cliente_id and not exists(select 1 from declaradas d where d.plano_legado_id=p.id)),
 (select count(*) from pcm.ocorrencias_preventivas l join declaradas d on d.plano_legado_id=l.plano_id),
 (select count(*) from pcm.ocorrencias_preventivas l join declaradas d on d.plano_legado_id=l.plano_id where not exists(select 1 from pcm.ocorrencias_rotina_vinculos c join pcm.ocorrencias_rotina_preparadas o on o.id=c.ocorrencia_preparada_id and o.plano_id=p_plano_id where c.ocorrencia_legada_id=l.id) and not exists(select 1 from pcm.sso_vinculos_visita_legado v join pcm.ocorrencias_visita_preparadas o on o.id=v.ocorrencia_visita_id and o.plano_id=p_plano_id where v.ocorrencia_legada_id=l.id))
 into v_relacoes,v_legados_sem_relacao,v_legadas,v_legadas_sem_ponte;
 return jsonb_build_object('revisaoPlano',p_expected_plano,'visitasPreparadasVersaoAnterior',v_visitas,'visitasSemPonteLegada',v_visitas_sem_ponte,'decisoesVisitaNaoImplementadas',v_visitas,'planosLegadosComRelacaoDeclarada',v_relacoes,'planosClienteSemRelacaoDeclarada',v_legados_sem_relacao,'ocorrenciasLegadasRelacionadas',v_legadas,'legadasSemPonteObservada',v_legadas_sem_ponte,'relacaoNaoComprovaEquivalencia',true,'fontesCompletas',false,'impactoIntegralComprovado',false,'aprovacaoAutorizada',false);
end; $$;
revoke all on function pcm.sso_avaliar_fontes_impacto_visita_legado(uuid,uuid,integer) from public,anon,authenticated,service_role;
