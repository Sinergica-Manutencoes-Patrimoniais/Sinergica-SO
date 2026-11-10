-- ADR-0480: localização somente leitura pela identidade lógica congelada.
create function pcm.sso_localizar_rotina_revisada(p_cliente_id uuid,p_plano_id uuid,p_versao_origem_id uuid,p_rotina_origem_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_origem pcm.plano_versoes%rowtype;v_rotina jsonb;v_n integer;v_logica uuid;v_destino pcm.rotinas_manutencao%rowtype;v_rascunho uuid;v_revisao integer;v_previa jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_revisao_exigencias_gate where id),false) then raise exception 'revisao_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_origem from pcm.plano_versoes where id=p_versao_origem_id and plano_id=p_plano_id and estado='aprovado';
 if not found or jsonb_typeof(v_origem.snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514'; end if;
 select count(*),min(item::text)::jsonb into v_n,v_rotina from jsonb_array_elements(v_origem.snapshot->'rotinas') x(item) where item->>'id'=p_rotina_origem_id::text;
 if v_n<>1 or v_rotina->>'rotina_logica_id' is null then raise exception 'identidade_historica_indisponivel' using errcode='23514'; end if;
 v_logica:=(v_rotina->>'rotina_logica_id')::uuid;
 select id into v_rascunho from pcm.plano_versoes where plano_id=p_plano_id and estado='rascunho';
 if v_rascunho is null then raise exception 'rascunho_indisponivel' using errcode='23514'; end if;
 select revisao into v_revisao from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id;
 v_previa:=pcm.sso_previa_revisao_revisionada(p_plano_id,v_revisao,1,null);
 if v_previa->>'versaoAnteriorId' is distinct from p_versao_origem_id::text or v_previa->>'versaoRascunhoId' is distinct from v_rascunho::text then raise exception 'origem_revisao_nao_comprovada' using errcode='23514'; end if;
 select count(*) into v_n from pcm.rotinas_manutencao where plano_id=p_plano_id and versao_id=v_rascunho and rotina_logica_id=v_logica;
 if v_n<>1 then raise exception 'copia_indisponivel_ou_ambigua' using errcode='23514'; end if;
 select * into v_destino from pcm.rotinas_manutencao where plano_id=p_plano_id and versao_id=v_rascunho and rotina_logica_id=v_logica;
 return jsonb_build_object('versaoOrigemId',p_versao_origem_id,'rotinaOrigemId',p_rotina_origem_id,'rotinaLogicaId',v_logica,'versaoRascunhoId',v_rascunho,'rotinaRascunhoId',v_destino.id,'edicaoIniciada',false);
end; $$;
revoke all on function pcm.sso_localizar_rotina_revisada(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
