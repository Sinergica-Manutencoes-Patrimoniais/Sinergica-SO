-- ADR-0423: acrescenta contagens parciais à comparação revisionada existente.
create function pcm.sso_ocorrencias_revisao_por_rotina(p_cliente_id uuid,p_plano_id uuid,p_revisao integer,p_apos uuid default null,p_limite integer default 20)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_base jsonb; v_item jsonb; v_lista jsonb:='[]'::jsonb; v_logica uuid; v_calendario integer; v_sem_ponte integer; v_visita integer;
begin
 if not coalesce((select habilitado from pcm.sso_impacto_revisao_os_gate where id),false) then raise exception 'impacto_revisao_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_base:=pcm.sso_indicios_revisao_por_rotina(p_cliente_id,p_plano_id,p_revisao,p_apos,p_limite);
 for v_item in select value from jsonb_array_elements(v_base->'items') loop
   v_logica:=(v_item->>'rotinaLogicaId')::uuid;
   select count(*),count(*) filter(where v.ocorrencia_legada_id is null) into v_calendario,v_sem_ponte from pcm.ocorrencias_rotina_preparadas o left join pcm.ocorrencias_rotina_vinculos v on v.ocorrencia_preparada_id=o.id where o.plano_id=p_plano_id and o.rotina_logica_id=v_logica;
   select count(*) into v_visita from pcm.ocorrencias_visita_preparadas o where o.plano_id=p_plano_id and o.rotina_logica_id=v_logica;
   v_lista:=v_lista||jsonb_build_array(v_item||jsonb_build_object('ocorrenciasCalendarioPreparadas',v_calendario,'ocorrenciasCalendarioSemPonte',v_sem_ponte,'ocorrenciasVisitaPreparadas',v_visita));
 end loop;
 return jsonb_build_object('revisao',p_revisao,'items',v_lista,'nextCursor',v_base->'nextCursor','fontesIncompletas',true,'impactoCalculado',false,'aprovacaoAutorizada',false);
end; $$;
revoke all on function pcm.sso_ocorrencias_revisao_por_rotina(uuid,uuid,integer,uuid,integer) from public,anon,authenticated,service_role;
