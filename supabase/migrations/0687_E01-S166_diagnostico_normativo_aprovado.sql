-- ADR-0461: leitura do snapshot, sem certificação normativa.
create function pcm.sso_diagnosticar_exigencia_aprovada(p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_versao pcm.plano_versoes%rowtype;v_rotina jsonb;v_exigencia jsonb;v_n integer;v_m integer;
begin
 if not coalesce((select habilitado from pcm.sso_snapshot_exigencia_legal_gate where id),false) then raise exception 'diagnostico_exigencia_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_versao from pcm.plano_versoes where id=p_versao_id and plano_id=p_plano_id and estado='aprovado';
 if not found or jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514'; end if;
 select count(*),min(item::text)::jsonb into v_n,v_rotina from jsonb_array_elements(v_versao.snapshot->'rotinas') x(item) where item->>'id'=p_rotina_id::text;
 if v_n<>1 then raise exception 'rotina_snapshot_indisponivel' using errcode='23514'; end if;
 if jsonb_typeof(v_versao.snapshot->'exigencias_rotinas')='array' then select count(*),min(item::text)::jsonb into v_m,v_exigencia from jsonb_array_elements(v_versao.snapshot->'exigencias_rotinas') x(item) where item->>'rotinaId'=p_rotina_id::text; else v_m:=0; end if;
 if v_m>1 then raise exception 'exigencia_snapshot_ambigua' using errcode='23514'; end if;
 return jsonb_build_object('rotinaId',p_rotina_id,'versaoId',p_versao_id,'classificacao',case when v_m=1 and v_exigencia->>'classificacao' in ('legal_normativa','nao_classificada','indeterminada') then v_exigencia->>'classificacao' else 'indeterminada' end,
 'referenciaDeclarada',case when v_m=1 then v_exigencia->>'referencia' else null end,'modo',v_rotina->>'modo','toleranciaAntes',v_rotina->'tolerancia_antes','toleranciaDepois',v_rotina->'tolerancia_depois',
 'snapshotExigenciaDisponivel',v_m=1,'referenciaValidada',false,'toleranciaValidada',false,'conformidadeCertificada',false);
end; $$;
revoke all on function pcm.sso_diagnosticar_exigencia_aprovada(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
