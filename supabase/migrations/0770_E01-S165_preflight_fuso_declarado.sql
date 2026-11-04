-- ADR-0545: diagnóstico lê fuso congelado e declaração proposta sem liberar aprovação.
create or replace function pcm.sso_preflight_aprovacao_revisao(p_cliente_id uuid,p_plano_id uuid,p_expected_revision integer,p_vigencia date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_plano pcm.planos_manutencao%rowtype;v_ant pcm.plano_versoes%rowtype;v_rasc pcm.plano_versoes%rowtype;v_aprovadas integer;v_snap boolean;v_config pcm.sso_fusos_plano_declarados%rowtype;v_fuso_historico text;v_fuso_historico_valido boolean;v_fuso_proposto_valido boolean;
begin
 if not coalesce((select habilitado from pcm.sso_guardar_impacto_aprovacao_gate where id),false) then raise exception 'preflight_aprovacao_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_plano from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id;
 if not found then raise exception 'plano_indisponivel' using errcode='42501'; end if;
 if p_expected_revision is null or v_plano.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if p_vigencia is null or not isfinite(p_vigencia) then raise exception 'vigencia_invalida' using errcode='22023'; end if;
 select * into v_ant from pcm.plano_versoes where plano_id=p_plano_id and estado='aprovado' order by numero desc limit 1;
 select * into v_rasc from pcm.plano_versoes where plano_id=p_plano_id and estado='rascunho';
 select count(*) into v_aprovadas from pcm.plano_versoes where plano_id=p_plano_id and estado='aprovado' and (vigencia_inicio is null or vigencia_fim is null or daterange(vigencia_inicio,vigencia_fim,'[]') && daterange(p_vigencia,null,'[)'));
 v_snap:=v_ant.id is not null and jsonb_typeof(v_ant.snapshot->'rotinas')='array';
 select * into v_config from pcm.sso_fusos_plano_declarados where plano_id=p_plano_id and cliente_id=p_cliente_id order by revisao desc limit 1;
 v_fuso_historico:=v_ant.snapshot->'fuso_plano'->>'fuso';
 v_fuso_historico_valido:=v_fuso_historico is not null and v_ant.snapshot->'fuso_plano'->>'vigenciaInicio'=v_ant.vigencia_inicio::text and exists(select 1 from pg_catalog.pg_timezone_names where name=v_fuso_historico);
 v_fuso_proposto_valido:=v_config.request_id is not null and exists(select 1 from pg_catalog.pg_timezone_names where name=v_config.fuso);
 return jsonb_build_object('revisao',v_plano.revisao,'estadoPlano',v_plano.estado,'versaoAnteriorId',v_ant.id,'rascunhoId',v_rasc.id,'snapshotAnteriorDisponivel',coalesce(v_snap,false),'vigenciaAnteriorInicio',v_ant.vigencia_inicio,'vigenciaAnteriorFim',v_ant.vigencia_fim,'vigenciaProposta',p_vigencia,'aprovadasPotencialmenteConflitantes',v_aprovadas,'impactoCompletoComprovado',false,'fusoPlanoDefinido',coalesce(v_fuso_historico_valido,false) and coalesce(v_fuso_proposto_valido,false),'fusoHistoricoDisponivel',coalesce(v_fuso_historico_valido,false),'fusoHistorico',v_fuso_historico,'fusoPropostoDeclarado',case when v_fuso_proposto_valido then v_config.fuso else null end,'fonteFusoValidada',false,'aprovacaoAutorizada',false,'motivoBloqueio','impacto_nao_comprovado');
end; $$;

