-- ADR-1520: conservar na comparação o snapshot da versão que originou a obrigação.
create function pcm.sso_origem_historica_impacto(p_plano uuid,p_preparada uuid,p_tipo text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_versao uuid;v_logica uuid;v_tipo text;v_alvo uuid;v_numero integer;v_snapshot jsonb;v_rotina jsonb;v_n integer;v_estado text:='historico_indeterminado';v_q_estado text:='indeterminado';v_q_hash text;
begin
 if p_tipo='calendario' then
  select versao_id,rotina_logica_id,alvo_tipo,alvo_id into v_versao,v_logica,v_tipo,v_alvo from pcm.ocorrencias_rotina_preparadas where id=p_preparada and plano_id=p_plano;
 elsif p_tipo='visita' then
  select versao_id,rotina_logica_id,alvo_tipo,alvo_id into v_versao,v_logica,v_tipo,v_alvo from pcm.ocorrencias_visita_preparadas where id=p_preparada and plano_id=p_plano;
 else raise exception 'tipo_invalido' using errcode='22023';end if;
 if not found then raise exception 'origem_ocorrencia_indisponivel' using errcode='23514';end if;
 select numero,snapshot into v_numero,v_snapshot from pcm.plano_versoes where id=v_versao and plano_id=p_plano and estado='aprovado';
 if found and jsonb_typeof(v_snapshot->'rotinas')='array' then
  select count(*),min(j.item::text)::jsonb into v_n,v_rotina from jsonb_array_elements(v_snapshot->'rotinas') j(item)
   where j.item->>'rotina_logica_id'=v_logica::text;
  if v_n=1 and v_rotina->>'alvo_tipo'=v_tipo and coalesce(v_rotina->>'sistema_id',v_rotina->>'equipamento_id',v_rotina->>'grupo_id')=v_alvo::text then
   v_estado:='disponivel';
   if v_rotina ? 'questionario_id' and v_rotina->>'questionario_id' is null and jsonb_typeof(v_rotina->'questionario') is distinct from 'object' then v_q_estado:='sem_questionario';
   elsif v_rotina->>'questionario_id' is not null and jsonb_typeof(v_rotina->'questionario')='object' and v_rotina->'questionario'->>'id'=v_rotina->>'questionario_id' and jsonb_typeof(v_rotina->'questionario'->'perguntas')='array' then v_q_estado:='disponivel';end if;
   if jsonb_typeof(v_rotina->'questionario')='object' then v_q_hash:=encode(pg_catalog.sha256(pg_catalog.convert_to((v_rotina->'questionario')::text,'UTF8')),'hex');end if;
  else v_rotina:=null;end if;
 end if;
 return jsonb_build_object('versaoId',v_versao,'numero',v_numero,'estado',v_estado,'rotina',pcm.sso_projetar_rotina_comparacao(v_rotina),'questionarioEstado',v_q_estado,'questionarioHash',v_q_hash);
end; $$;
revoke all on function pcm.sso_origem_historica_impacto(uuid,uuid,text) from public,anon,authenticated,service_role;

-- Campo ausente no snapshot anterior não significa ausência de questionário.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_fotografia_questionario_impacto(uuid,integer,uuid,uuid)'::regprocedure);
 a text:=$antes$ elsif v_id_anterior is null and v_id_atual is null then v_estado:='sem_questionario';$antes$;
 b text:=$depois$ elsif not (v_antiga ? 'questionario_id') then v_estado:='historico_indeterminado';
 elsif v_id_anterior is null and v_id_atual is null then v_estado:='sem_questionario';$depois$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'definicao_questionario_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;

-- V3 permanece responsável pela proteção de OS; incluir também origem histórica na mesma comparação.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_comparar_rotina_impacto_v3(uuid,uuid,uuid,integer,uuid,uuid,text)'::regprocedure);
 a text:=$antes$return v_base||jsonb_build_object('osImpacto',v_os,'osOutroCliente',v_outros>0);$antes$;
 b text:=$depois$return v_base||jsonb_build_object('osImpacto',v_os,'osOutroCliente',v_outros>0,'origemOcorrencia',pcm.sso_origem_historica_impacto(p_plano_id,p_preparada_id,p_tipo));$depois$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'definicao_comparacao_v3_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;
