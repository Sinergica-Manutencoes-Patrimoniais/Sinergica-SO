-- ADR-0558: comparação parcial das decisões 0781 com dados atuais.
create or replace function pcm.sso_avaliar_fontes_impacto_visita_legado(p_cliente_id uuid,p_plano_id uuid,p_expected_plano integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_previa jsonb;v_origem uuid;v_visitas integer;v_visitas_sem_ponte integer;v_relacoes integer;v_legados_sem_relacao integer;v_legadas integer;v_legadas_sem_ponte integer;v_sem_identidade integer;v_sem_decisao integer;v_obsoletas integer;v_reconciliar integer;v_rascunho uuid;
begin
 if not coalesce((select habilitado from pcm.sso_avaliacao_impacto_revisao_gate where id),false) or not coalesce((select habilitado from pcm.sso_decisao_impacto_revisao_gate where id),false) then raise exception 'avaliacao_impacto_bloqueada' using errcode='55000';end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501';end if;
 v_previa:=pcm.sso_previa_revisao_revisionada(p_plano_id,p_expected_plano,1,null);v_origem:=(v_previa->>'versaoAnteriorId')::uuid;v_rascunho:=(v_previa->>'versaoRascunhoId')::uuid;
 select count(*),count(*) filter(where not exists(select 1 from pcm.sso_vinculos_visita_legado v where v.ocorrencia_visita_id=o.id)) into v_visitas,v_visitas_sem_ponte from pcm.ocorrencias_visita_preparadas o where o.plano_id=p_plano_id and o.versao_id=v_origem;
 with itens as (
  select o.id,c.ciclo_id,d.request_id,d.revisao_plano,d.decisao,d.fotografia,to_jsonb(o) preparada,v.ocorrencia_legada_id,
   (select count(*) from pcm.ordens_servico os where os.ocorrencia_preventiva_id=v.ocorrencia_legada_id and os.client_id=p_cliente_id and os.deleted_at is null) os_count,
   (select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'status',s.status,'updatedAt',s.updated_at) order by s.id),'[]'::jsonb) from (select os.id,os.status,os.updated_at from pcm.ordens_servico os where os.ocorrencia_preventiva_id=v.ocorrencia_legada_id and os.client_id=p_cliente_id and os.deleted_at is null order by os.id limit 101) s) os_atuais
  from pcm.ocorrencias_visita_preparadas o left join pcm.sso_ciclo_visita_versoes c on c.preparada_id=o.id and c.versao_id=o.versao_id
  left join pcm.sso_vinculos_visita_legado v on v.ocorrencia_visita_id=o.id and v.cliente_id=p_cliente_id
  left join lateral (select x.* from pcm.sso_decisoes_impacto_visita x where x.rascunho_id=v_rascunho and x.preparada_id=o.id order by x.revisao desc limit 1) d on true
  where o.plano_id=p_plano_id and o.versao_id=v_origem
 ) select count(*) filter(where ciclo_id is null),count(*) filter(where request_id is null),count(*) filter(where request_id is not null and (revisao_plano<>p_expected_plano or fotografia->'preparada' is distinct from preparada or fotografia->>'cicloVisitaId' is distinct from ciclo_id::text or fotografia->>'legadaId' is distinct from ocorrencia_legada_id::text or fotografia->'os' is distinct from os_atuais or os_count>100)),count(*) filter(where decisao='exige_reconciliacao') into v_sem_identidade,v_sem_decisao,v_obsoletas,v_reconciliar from itens;
 with relacoes as (select distinct on (d.plano_legado_id) d.plano_legado_id,d.decisao from pcm.sso_declaracoes_planos_legados d where d.plano_id=p_plano_id and d.cliente_id=p_cliente_id order by d.plano_legado_id,d.revisao desc),
 declaradas as (select r.plano_legado_id from relacoes r join pcm.planos_preventivos p on p.id=r.plano_legado_id and p.cliente_id=p_cliente_id where r.decisao='declarar')
 select (select count(*) from declaradas),
 (select count(*) from pcm.planos_preventivos p where p.cliente_id=p_cliente_id and not exists(select 1 from declaradas d where d.plano_legado_id=p.id)),
 (select count(*) from pcm.ocorrencias_preventivas l join declaradas d on d.plano_legado_id=l.plano_id),
 (select count(*) from pcm.ocorrencias_preventivas l join declaradas d on d.plano_legado_id=l.plano_id where not exists(select 1 from pcm.ocorrencias_rotina_vinculos c join pcm.ocorrencias_rotina_preparadas o on o.id=c.ocorrencia_preparada_id and o.plano_id=p_plano_id where c.ocorrencia_legada_id=l.id) and not exists(select 1 from pcm.sso_vinculos_visita_legado v join pcm.ocorrencias_visita_preparadas o on o.id=v.ocorrencia_visita_id and o.plano_id=p_plano_id where v.ocorrencia_legada_id=l.id))
 into v_relacoes,v_legados_sem_relacao,v_legadas,v_legadas_sem_ponte;
 return jsonb_build_object('revisaoPlano',p_expected_plano,'visitasPreparadasVersaoAnterior',v_visitas,'visitasSemPonteLegada',v_visitas_sem_ponte,'visitasSemIdentidade',v_sem_identidade,'decisoesVisitaAusentes',v_sem_decisao,'decisoesVisitaObsoletas',v_obsoletas,'visitasExigemReconciliacao',v_reconciliar,'planosLegadosComRelacaoDeclarada',v_relacoes,'planosClienteSemRelacaoDeclarada',v_legados_sem_relacao,'ocorrenciasLegadasRelacionadas',v_legadas,'legadasSemPonteObservada',v_legadas_sem_ponte,'relacaoNaoComprovaEquivalencia',true,'fontesCompletas',false,'impactoIntegralComprovado',false,'aprovacaoAutorizada',false);
end; $$;

