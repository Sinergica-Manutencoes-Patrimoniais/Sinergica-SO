-- ADR-0682: contrato aditivo e descrição histórica para Grupo.
create function pcm.sso_origem_pendencia_v2(p_pendencia_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_origem jsonb;v_p pcm.sso_pendencias_tecnicas%rowtype;
begin
 v_origem:=pcm.sso_origem_pendencia(p_pendencia_id);
 select * into v_p from pcm.sso_pendencias_tecnicas where id=p_pendencia_id;
 if not found or (v_p.ocorrencia_id is null)=(v_p.ocorrencia_grupo_id is null) then raise exception 'origem_indisponivel' using errcode='23514'; end if;
 return v_origem||jsonb_build_object('ocorrenciaGrupoId',v_p.ocorrencia_grupo_id,'tipoOrigem',case when v_p.ocorrencia_grupo_id is null then 'legada' else 'grupo' end);
end; $$;
revoke all on function pcm.sso_origem_pendencia_v2(uuid) from public,anon,authenticated,service_role;
do $migration$
declare v_def text;
 v_os_antigo text:=$old$join pcm.ordens_servico os on os.id=p.os_id and os.client_id=p_cliente_id and os.deleted_at is null and os.ocorrencia_preventiva_id=p.ocorrencia_id$old$;
 v_os_novo text:=$new$join pcm.ordens_servico os on os.id=p.os_id and os.client_id=p_cliente_id and os.deleted_at is null and ((p.ocorrencia_grupo_id is null and os.ocorrencia_preventiva_id=p.ocorrencia_id) or (p.ocorrencia_id is null and p.ocorrencia_grupo_id is not null and os.ocorrencia_preventiva_id is null and os.chamado_id is null))$new$;
 v_origem_antiga text:=$old$cross join lateral (select case when exists(select 1 from pcm.sso_vinculos_visita_legado vv where vv.ocorrencia_legada_id=p.ocorrencia_id and vv.cliente_id=p_cliente_id) then pcm.sso_resolver_origem_execucao(p_cliente_id,p.ocorrencia_id) else null::jsonb end as dados) origem$old$;
 v_origem_nova text:=$new$cross join lateral (select case when p.ocorrencia_grupo_id is not null then
   (select jsonb_build_object('tipo','grupo','planoId',og.plano_id,'versaoId',og.versao_id,'rotinaId',og.rotina_id,'grupoId',og.grupo_id) from pcm.sso_vinculos_os_grupo vg join pcm.sso_ocorrencias_grupo og on og.id=vg.ocorrencia_grupo_id and og.cliente_id=vg.cliente_id where vg.os_id=os.id and vg.cliente_id=p_cliente_id and og.id=p.ocorrencia_grupo_id)
   when exists(select 1 from pcm.sso_vinculos_visita_legado vv where vv.ocorrencia_legada_id=p.ocorrencia_id and vv.cliente_id=p_cliente_id) then pcm.sso_resolver_origem_execucao(p_cliente_id,p.ocorrencia_id) else null::jsonb end as dados) origem$new$;
 v_plano_antigo text:=$old$(origem.dados->>'tipo'='visita' and plano.id=(origem.dados->>'planoId')::uuid$old$;
 v_plano_novo text:=$new$(origem.dados->>'tipo' in ('visita','grupo') and plano.id=(origem.dados->>'planoId')::uuid$new$;
 v_questao_antiga text:=$old$and q.item->>'id'=resp.chave_pergunta;$old$;
 v_questao_nova text:=$new$and (origem.dados->>'tipo' is distinct from 'grupo' or (r.item->>'alvo_tipo'='grupo' and r.item->>'grupo_id'=origem.dados->>'grupoId')) and q.item->>'id'=resp.chave_pergunta;$new$;
begin
 select pg_catalog.pg_get_functiondef('pcm.sso_descricao_historica_pendencia(uuid,uuid)'::regprocedure) into v_def;
 if position(v_os_antigo in v_def)=0 or position(v_origem_antiga in v_def)=0 or position(v_plano_antigo in v_def)=0 or position(v_questao_antiga in v_def)=0 then raise exception 'descricao_definicao_incompativel' using errcode='55000'; end if;
 v_def:=replace(v_def,v_os_antigo,v_os_novo);v_def:=replace(v_def,v_origem_antiga,v_origem_nova);v_def:=replace(v_def,v_plano_antigo,v_plano_novo);v_def:=replace(v_def,v_questao_antiga,v_questao_nova);
 execute v_def;
end;
$migration$;
revoke all on function pcm.sso_descricao_historica_pendencia(uuid,uuid) from public,anon,authenticated,service_role;
