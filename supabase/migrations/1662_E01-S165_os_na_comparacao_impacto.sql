-- ADR-1519: OS conhecidas fazem parte do que PCM confere e do CAS da decisão.
create function pcm.sso_comparar_rotina_impacto_v3(
 p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_plano integer,p_rascunho_id uuid,p_preparada_id uuid,p_tipo text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_base jsonb;v_foto jsonb;v_legada uuid;v_os jsonb;v_count bigint;v_outros bigint;
begin
 v_base:=pcm.sso_comparar_rotina_impacto_v2(p_ator_id,p_cliente_id,p_plano_id,p_expected_plano,p_rascunho_id,p_preparada_id,p_tipo);
 -- Garante a mesma fotografia de fontes conhecidas durante esta consulta e até o commit da decisão.
 lock table pcm.ocorrencias_rotina_vinculos,pcm.sso_vinculos_visita_legado in share mode nowait;
 perform pcm.sso_travar_fontes_impacto_grupo();
 v_foto:=pcm.sso_fotografar_efeitos_impacto_grupo(p_cliente_id,p_plano_id,p_preparada_id,p_tipo);
 if p_tipo='calendario' then
  select ocorrencia_legada_id into v_legada from pcm.ocorrencias_rotina_vinculos where ocorrencia_preparada_id=p_preparada_id;
 else
  select ocorrencia_legada_id into v_legada from pcm.sso_vinculos_visita_legado where ocorrencia_visita_id=p_preparada_id and cliente_id=p_cliente_id;
 end if;
 with ids as (
  select (j.item->>'id')::uuid id from jsonb_array_elements(v_foto->'os') j(item)
  union select os.id from pcm.ordens_servico os where os.ocorrencia_preventiva_id=v_legada and os.deleted_at is null
 ), os as (
  select o.id,o.status,o.updated_at,o.client_id from ids join pcm.ordens_servico o on o.id=ids.id where o.deleted_at is null
 )
 select count(*) filter(where client_id=p_cliente_id),count(*) filter(where client_id is distinct from p_cliente_id),
  coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status,'atualizadaEm',updated_at) order by id) filter(where client_id=p_cliente_id),'[]'::jsonb)
 into v_count,v_outros,v_os from os;
 if v_count>100 then raise exception 'os_excedem_limite_reconciliacao' using errcode='23514';end if;
 return v_base||jsonb_build_object('osImpacto',v_os,'osOutroCliente',v_outros>0);
end; $$;
revoke all on function pcm.sso_comparar_rotina_impacto_v3(uuid,uuid,uuid,integer,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_comparar_rotina_impacto_v3(uuid,uuid,uuid,integer,uuid,uuid,text) to authenticated;

do $migracao$
declare v_def text:=pg_catalog.pg_get_functiondef('pcm.sso_decidir_impacto_comparado(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,text,jsonb)'::regprocedure);
 v_antes text:='v_atual:=pcm.sso_comparar_rotina_impacto_v2(';
 v_depois text:='v_atual:=pcm.sso_comparar_rotina_impacto_v3(';
begin
 if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>1 then raise exception 'definicao_decisao_comparada_incompativel' using errcode='55000';end if;
 execute replace(v_def,v_antes,v_depois);
end; $migracao$;
