-- ADR-1378: preserva o contrato e deixa o núcleo anterior privado.
alter function pcm.sso_estado_ocorrencia_vinculada(uuid,uuid,uuid) rename to sso_estado_ocorrencia_vinculada_base_1524;
revoke all on function pcm.sso_estado_ocorrencia_vinculada_base_1524(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_estado_ocorrencia_vinculada(p_cliente_id uuid,p_plano_id uuid,p_preparada_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_estado jsonb; v_ciclo uuid;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 v_estado:=pcm.sso_estado_ocorrencia_vinculada_base_1524(p_cliente_id,p_plano_id,p_preparada_id);
 if v_estado->>'estado'='candidata_aguardando' then
   lock table pcm.os_rotina_vinculos_explicitos,pcm.sso_ciclo_calendario_versoes in share mode nowait;
   select cv.ciclo_id into v_ciclo from pcm.sso_ciclo_calendario_versoes cv where cv.preparada_id=p_preparada_id;
   if exists(select 1 from pcm.os_rotina_vinculos_explicitos v
     where v.ocorrencia_preparada_id=p_preparada_id
       or (v_ciclo is not null and exists(select 1 from pcm.sso_ciclo_calendario_versoes outra
         where outra.preparada_id=v.ocorrencia_preparada_id and outra.ciclo_id=v_ciclo))) then
     v_estado:=jsonb_set(v_estado,'{estado}',to_jsonb('indeterminado'::text));
   end if;
 end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_estado;
end; $$;
revoke all on function pcm.sso_estado_ocorrencia_vinculada(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_estado_ocorrencia_vinculada(uuid,uuid,uuid) to authenticated;
