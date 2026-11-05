-- ADR-1481: comparação de declaração com regras vinculadas; sem aprovação.
create function pcm.sso_conferir_fuso_series_revisao(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_revision integer,p_vigencia date)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_previa jsonb;v_rascunho uuid;v_fuso pcm.sso_fusos_plano_declarados%rowtype;v_rotinas bigint;v_sem_serie bigint;v_series bigint;v_sem_regra bigint;v_contrato_divergente bigint;v_fuso_divergente bigint;
begin
 if p_vigencia is null or not isfinite(p_vigencia) then raise exception 'vigencia_invalida' using errcode='22023'; end if;
 perform pcm.sso_conferir_diagnostico_revisao(p_ator_id,p_cliente_id,p_plano_id,p_expected_revision,'preflight');
 -- Travas de tabela incluem inserções ainda inexistentes; NOWAIT evita espera circular.
 lock table pcm.rotinas_manutencao,pcm.rotina_visita_serie_vinculos,pcm.rotina_serie_vigencias,pcm.calendario_contratual_series,pcm.regras_visita_contratual,pcm.sso_fusos_plano_declarados in share mode nowait;
 v_previa:=pcm.sso_previa_revisao_revisionada(p_plano_id,p_expected_revision,1,null);
 v_rascunho:=(v_previa->>'versaoRascunhoId')::uuid;
 select * into v_fuso from pcm.sso_fusos_plano_declarados where cliente_id=p_cliente_id and plano_id=p_plano_id order by revisao desc limit 1;
 with rotinas as (
  select r.rotina_logica_id from pcm.rotinas_manutencao r where r.plano_id=p_plano_id and r.versao_id=v_rascunho and r.modo='visita'
 ), series as (
  select distinct s.id,s.contrato_id from rotinas r join pcm.rotina_visita_serie_vinculos l on l.plano_id=p_plano_id and l.rotina_logica_id=r.rotina_logica_id
  join pcm.calendario_contratual_series s on s.id=l.serie_id and s.cliente_id=p_cliente_id
  where exists(select 1 from pcm.rotina_serie_vigencias g where g.plano_id=p_plano_id and g.rotina_logica_id=r.rotina_logica_id and g.serie_id=s.id and g.inicio<=p_vigencia and (g.fim is null or g.fim>=p_vigencia))
 ), regras as (
  select s.id,s.contrato_id,r.fuso from series s left join pcm.regras_visita_contratual r on r.serie_id=s.id and r.vigencia_inicio<=p_vigencia and (r.vigencia_fim is null or r.vigencia_fim>=p_vigencia)
 )
 select (select count(*) from rotinas),
  (select count(*) from rotinas r where not exists(select 1 from pcm.rotina_visita_serie_vinculos l join pcm.calendario_contratual_series s on s.id=l.serie_id and s.cliente_id=p_cliente_id where l.plano_id=p_plano_id and l.rotina_logica_id=r.rotina_logica_id and exists(select 1 from pcm.rotina_serie_vigencias g where g.plano_id=p_plano_id and g.rotina_logica_id=r.rotina_logica_id and g.serie_id=s.id and g.inicio<=p_vigencia and (g.fim is null or g.fim>=p_vigencia)))),
  (select count(*) from series),
  (select count(*) from regras where fuso is null),
  (select count(*) from regras where v_fuso.contrato_referencia_id is null or contrato_id is distinct from v_fuso.contrato_referencia_id),
  (select count(*) from regras where fuso is not null and fuso is distinct from v_fuso.fuso)
 into v_rotinas,v_sem_serie,v_series,v_sem_regra,v_contrato_divergente,v_fuso_divergente;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return jsonb_build_object('revisaoPlano',p_expected_revision,'vigencia',p_vigencia,'rotinasVisita',v_rotinas,'rotinasSemSerie',v_sem_serie,'series',v_series,'seriesSemRegraVigente',v_sem_regra,'seriesContratoDivergente',v_contrato_divergente,'seriesFusoDivergente',v_fuso_divergente,
  'declaracaoDisponivel',v_fuso.request_id is not null,'consistenciaObservada',v_fuso.request_id is not null and v_fuso.contrato_referencia_id is not null and v_rotinas>0 and v_sem_serie=0 and v_series>0 and v_sem_regra=0 and v_contrato_divergente=0 and v_fuso_divergente=0,
  'vinculoHistoricoComprovado',false,'fonteContratualValidada',false,'aprovacaoAutorizada',false);
end; $$;
revoke all on function pcm.sso_conferir_fuso_series_revisao(uuid,uuid,uuid,integer,date) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_conferir_fuso_series_revisao(uuid,uuid,uuid,integer,date) to authenticated;
