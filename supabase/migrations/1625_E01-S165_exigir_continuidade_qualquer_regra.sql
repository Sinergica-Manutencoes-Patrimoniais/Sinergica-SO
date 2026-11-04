-- ADR-1482: qualquer reutilização entre versões exige decisão aprovada.
create function pcm.sso_exigir_continuidade_ciclo_revisao(p_cliente uuid,p_plano uuid,p_versao uuid,p_rotina uuid,p_preparada uuid,p_vencimento date)
returns void language plpgsql volatile security definer set search_path='' as $$
declare v_versao_origem uuid;
begin
 perform 1 from pcm.sso_continuidade_revisao_gate where id and habilitado for share;
 if not found then return; end if;
 select o.versao_id into v_versao_origem from pcm.ocorrencias_rotina_preparadas o where o.id=p_preparada and o.plano_id=p_plano for share;
 if not found then raise exception 'ocorrencia_origem_indisponivel' using errcode='23514'; end if;
 if v_versao_origem is distinct from p_versao and not pcm.sso_continuidade_ciclo_autorizada(p_cliente,p_plano,p_versao,p_rotina,p_preparada,p_vencimento) then
  raise exception 'continuidade_ciclo_nao_aprovada' using errcode='23514';
 end if;
end; $$;
revoke all on function pcm.sso_exigir_continuidade_ciclo_revisao(uuid,uuid,uuid,uuid,uuid,date) from public,anon,authenticated,service_role;

do $migracao$
declare v_def text:=pg_catalog.pg_get_functiondef('pcm.sso_materializar_ciclo_canonico(uuid,uuid,uuid,uuid,uuid,integer,date)'::regprocedure);
 v_antes text:=$antes$ insert into pcm.sso_ciclo_canonico_usos_versao(ciclo_id,versao_id,rotina_id,preparada_id,ator_id)$antes$;
 v_depois text:=$depois$ perform pcm.sso_exigir_continuidade_ciclo_revisao(p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,v_preparada,p_vencimento);
 insert into pcm.sso_ciclo_canonico_usos_versao(ciclo_id,versao_id,rotina_id,preparada_id,ator_id)$depois$;
begin
 if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>1 then raise exception 'definicao_ciclo_incompativel' using errcode='55000'; end if;
 execute replace(v_def,v_antes,v_depois);
end; $migracao$;
