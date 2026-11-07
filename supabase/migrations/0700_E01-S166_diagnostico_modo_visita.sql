-- ADR-0474: diagnóstico de suporte técnico atual, não cria regra de negócio.
create function pcm.sso_diagnosticar_modo_visita(p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_versao pcm.plano_versoes%rowtype;v_rotina jsonb;v_num integer;v_suportado boolean;
begin
 if not coalesce((select habilitado from pcm.ocorrencia_rotina_gate where id),false) then raise exception 'diagnostico_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_versao from pcm.plano_versoes where id=p_versao_id and plano_id=p_plano_id;
 if not found then raise exception 'versao_indisponivel' using errcode='23514'; end if;
 if v_versao.estado='aprovado' then
  if jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indeterminado' using errcode='23514'; end if;
  select count(*),min(item::text)::jsonb into v_num,v_rotina from jsonb_array_elements(v_versao.snapshot->'rotinas') x(item) where item->>'id'=p_rotina_id::text;
 else select count(*),min(to_jsonb(r)::text)::jsonb into v_num,v_rotina from pcm.rotinas_manutencao r where r.plano_id=p_plano_id and r.versao_id=p_versao_id and r.id=p_rotina_id;end if;
 if v_num<>1 then raise exception 'rotina_indisponivel' using errcode='23514'; end if;
 v_suportado:=v_rotina->>'modo'='visita' and v_rotina->>'intervalo_n'='1' and v_rotina->>'intervalo_unidade'='semanas';
 return jsonb_build_object('modo',v_rotina->>'modo','intervalo',v_rotina->'intervalo_n','unidade',v_rotina->>'intervalo_unidade','suportadoPeloGeradorPreparado',coalesce(v_suportado,false),'parametrosAusentes',v_rotina->>'modo' is null or v_rotina->>'intervalo_n' is null or v_rotina->>'intervalo_unidade' is null,'regraOperacionalNovaInferida',false,'geracaoExecutada',false,'fonteMutavel',v_versao.estado='rascunho');
end; $$;
revoke all on function pcm.sso_diagnosticar_modo_visita(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
