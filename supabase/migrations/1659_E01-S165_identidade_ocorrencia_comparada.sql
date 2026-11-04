-- ADR-1516: a identidade usada pelo PCM também integra a comparação transacional.
create function pcm.sso_comparar_rotina_impacto_v2(
 p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_plano integer,p_rascunho_id uuid,p_preparada_id uuid,p_tipo text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_base jsonb;v_ciclo integer;v_visita uuid;v_semana date;
begin
 v_base:=pcm.sso_comparar_rotina_impacto(p_ator_id,p_cliente_id,p_plano_id,p_expected_plano,p_rascunho_id,p_preparada_id,p_tipo);
 if p_tipo='calendario' then
  select ciclo into v_ciclo from pcm.ocorrencias_rotina_preparadas where id=p_preparada_id and plano_id=p_plano_id;
 else
  select visita_id,semana_origem into v_visita,v_semana from pcm.ocorrencias_visita_preparadas where id=p_preparada_id and plano_id=p_plano_id;
 end if;
 if not found then raise exception 'origem_ocorrencia_indisponivel' using errcode='23514';end if;
 return v_base||jsonb_build_object('ciclo',v_ciclo,'visitaId',v_visita,'semanaOrigem',v_semana);
end; $$;
revoke all on function pcm.sso_comparar_rotina_impacto_v2(uuid,uuid,uuid,integer,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_comparar_rotina_impacto_v2(uuid,uuid,uuid,integer,uuid,uuid,text) to authenticated;

do $migracao$
declare v_def text:=pg_catalog.pg_get_functiondef('pcm.sso_decidir_impacto_comparado(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,text,jsonb)'::regprocedure);
 v_antes text:='v_atual:=pcm.sso_comparar_rotina_impacto(';
 v_depois text:='v_atual:=pcm.sso_comparar_rotina_impacto_v2(';
begin
 if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>1 then raise exception 'definicao_decisao_comparada_incompativel' using errcode='55000';end if;
 execute replace(v_def,v_antes,v_depois);
end; $migracao$;
