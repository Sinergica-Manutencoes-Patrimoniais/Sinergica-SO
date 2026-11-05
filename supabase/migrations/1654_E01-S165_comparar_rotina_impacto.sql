-- ADR-1511: comparação autorizada por identidade lógica, sem alterar a decisão.
create function pcm.sso_comparar_rotina_impacto(
 p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_plano integer,p_rascunho_id uuid,p_preparada_id uuid,p_tipo text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_previa jsonb;v_origem uuid;v_logica uuid;v_alvo_tipo text;v_alvo uuid;v_vencimento date;v_snapshot jsonb;v_anterior jsonb;v_rascunho jsonb;v_contagem integer;
begin
 if p_tipo is null or p_tipo not in ('calendario','visita') or p_rascunho_id is null or p_preparada_id is null or p_expected_plano is null or p_expected_plano<1 then raise exception 'parametros_invalidos' using errcode='22023';end if;
 perform pcm.sso_conferir_decisao_impacto_mediada(p_ator_id,p_cliente_id,p_plano_id,p_tipo='visita');
 perform 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id and revisao=p_expected_plano for share nowait;
 if not found then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 v_previa:=pcm.sso_previa_revisao_revisionada(p_plano_id,p_expected_plano,1,null);
 v_origem:=(v_previa->>'versaoAnteriorId')::uuid;
 if v_previa->>'versaoRascunhoId' is distinct from p_rascunho_id::text then raise exception 'rascunho_indisponivel' using errcode='23514';end if;
 if p_tipo='calendario' then
  select o.rotina_logica_id,o.alvo_tipo,o.alvo_id,o.vencimento_original into v_logica,v_alvo_tipo,v_alvo,v_vencimento
   from pcm.ocorrencias_rotina_preparadas o where o.id=p_preparada_id and o.plano_id=p_plano_id
    and (o.versao_id=v_origem or exists(select 1 from pcm.sso_ciclo_canonico_usos_versao u where u.preparada_id=o.id and u.versao_id=v_origem) or exists(select 1 from pcm.sso_continuidades_ciclo_aprovadas c join pcm.plano_versoes vs on vs.id=c.versao_id and vs.plano_id=c.plano_id and vs.estado='aprovado' and vs.vigencia_inicio=c.vigencia where c.preparada_id=o.id and c.plano_id=o.plano_id and c.versao_id=v_origem));
 else
  select o.rotina_logica_id,o.alvo_tipo,o.alvo_id,o.vencimento_original into v_logica,v_alvo_tipo,v_alvo,v_vencimento
   from pcm.ocorrencias_visita_preparadas o where o.id=p_preparada_id and o.plano_id=p_plano_id
    and (o.versao_id=v_origem or exists(select 1 from pcm.sso_ciclo_visita_usos_versao u where u.preparada_id=o.id and u.versao_id=v_origem) or exists(select 1 from pcm.sso_continuidades_visita_aprovadas c join pcm.plano_versoes vs on vs.id=c.versao_id and vs.plano_id=c.plano_id and vs.estado='aprovado' and vs.vigencia_inicio=c.vigencia where c.preparada_id=o.id and c.plano_id=o.plano_id and c.versao_id=v_origem));
 end if;
 if not found or v_logica is null then raise exception 'origem_ocorrencia_indisponivel' using errcode='23514';end if;
 select v.snapshot into v_snapshot from pcm.plano_versoes v where v.id=v_origem and v.plano_id=p_plano_id and v.estado='aprovado';
 if not found or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514';end if;
 select count(*),min(j.item::text)::jsonb into v_contagem,v_anterior from jsonb_array_elements(v_snapshot->'rotinas') j(item) where j.item->>'rotina_logica_id'=v_logica::text;
 if v_contagem<>1 then raise exception 'rotina_anterior_indeterminada' using errcode='23514';end if;
 select count(*),min(to_jsonb(r)::text)::jsonb into v_contagem,v_rascunho from pcm.rotinas_manutencao r where r.plano_id=p_plano_id and r.versao_id=p_rascunho_id and r.rotina_logica_id=v_logica;
 if v_contagem>1 then raise exception 'rotina_rascunho_ambigua' using errcode='23514';end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or (p_tipo='visita' and config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true) then raise exception 'sem_acesso' using errcode='42501';end if;
 return jsonb_build_object('preparadaId',p_preparada_id,'rascunhoId',p_rascunho_id,'revisaoPlano',p_expected_plano,'tipo',p_tipo,'rotinaLogicaId',v_logica,
  'alvoOcorrenciaTipo',v_alvo_tipo,'alvoOcorrenciaId',v_alvo,'vencimentoOriginal',v_vencimento,
  'anterior',pcm.sso_projetar_rotina_comparacao(v_anterior),'rascunho',pcm.sso_projetar_rotina_comparacao(v_rascunho),
  'fontesCompletas',false,'aprovacaoAutorizada',false);
end; $$;
revoke all on function pcm.sso_comparar_rotina_impacto(uuid,uuid,uuid,integer,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_comparar_rotina_impacto(uuid,uuid,uuid,integer,uuid,uuid,text) to authenticated;
