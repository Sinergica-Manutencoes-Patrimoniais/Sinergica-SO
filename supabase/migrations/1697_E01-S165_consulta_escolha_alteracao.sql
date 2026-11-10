-- ADR-1544: leitura mediada do subtipo da última decisão, sem alterar aprovação.
create function pcm.sso_consultar_escolha_alteracao_ciclo(p_ator uuid,p_cliente uuid,p_plano uuid,p_rascunho uuid,p_preparada uuid,p_revisao_plano integer,p_revisao_decisao integer,p_tipo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_request uuid;v_revisao integer;v_plano integer;v_registrada boolean;v_atual boolean:=false;
begin
 if p_tipo is null or p_tipo not in ('calendario','visita') or p_preparada is null or p_rascunho is null or p_revisao_plano is null or p_revisao_decisao is null then raise exception 'parametros_invalidos' using errcode='22023';end if;
 perform pcm.sso_conferir_decisao_impacto_mediada(p_ator,p_cliente,p_plano,p_tipo='visita');
 perform 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente and revisao=p_revisao_plano for share nowait;
 if not found then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 if p_tipo='calendario' then
  select request_id,revisao,revisao_plano into v_request,v_revisao,v_plano from pcm.sso_decisoes_impacto_ocorrencia where cliente_id=p_cliente and plano_id=p_plano and rascunho_id=p_rascunho and preparada_id=p_preparada order by revisao desc limit 1;
 else
  select request_id,revisao,revisao_plano into v_request,v_revisao,v_plano from pcm.sso_decisoes_impacto_visita where cliente_id=p_cliente and plano_id=p_plano and rascunho_id=p_rascunho and preparada_id=p_preparada order by revisao desc limit 1;
 end if;
 if v_request is null or v_revisao is distinct from p_revisao_decisao or v_plano is distinct from p_revisao_plano then raise exception 'decisao_obsoleta' using errcode='40001';end if;
 select exists(select 1 from pcm.sso_escolhas_alteracao_ciclo where request_id=v_request and tipo=p_tipo and cliente_id=p_cliente and plano_id=p_plano and rascunho_id=p_rascunho and preparada_id=p_preparada and revisao_plano=p_revisao_plano) into v_registrada;
 if v_registrada then v_atual:=pcm.sso_escolha_alteracao_atual(p_tipo,v_request,p_cliente,p_plano,p_rascunho,p_revisao_plano);end if;
 return jsonb_build_object('preparadaId',p_preparada,'revisaoDecisao',v_revisao,'registrada',v_registrada,'atual',coalesce(v_atual,false));
end; $$;
revoke all on function pcm.sso_consultar_escolha_alteracao_ciclo(uuid,uuid,uuid,uuid,uuid,integer,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_escolha_alteracao_ciclo(uuid,uuid,uuid,uuid,uuid,integer,integer,text) to authenticated;
