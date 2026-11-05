-- ADR-0680: adapta fonte de perguntas, mantendo bloqueio de retorno.
do $migration$
declare v_def text;
 v_antigo text:=$old$ if exists(select 1 from pcm.sso_vinculos_visita_legado vinc where vinc.ocorrencia_legada_id=v_legada and vinc.cliente_id=p_cliente_id) then$old$;
 v_novo text:=$new$ if exists(select 1 from pcm.sso_vinculos_os_grupo vg where vg.os_id=v_retorno.os_id and vg.cliente_id=p_cliente_id) then
   select v.snapshot into v_snapshot from pcm.sso_vinculos_os_grupo vg
   join pcm.sso_ocorrencias_grupo og on og.id=vg.ocorrencia_grupo_id and og.cliente_id=vg.cliente_id
   join pcm.ordens_servico os on os.id=vg.os_id and os.client_id=vg.cliente_id and os.deleted_at is null and os.ocorrencia_preventiva_id is null and os.chamado_id is null
   join pcm.planos_manutencao plano on plano.id=og.plano_id and plano.cliente_id=vg.cliente_id
   join pcm.plano_versoes v on v.id=og.versao_id and v.plano_id=plano.id and v.estado='aprovado'
   where vg.os_id=v_retorno.os_id and vg.cliente_id=p_cliente_id and og.versao_id=v_retorno.versao_id and og.rotina_id=v_retorno.rotina_id
   and (select count(*) from jsonb_array_elements(case when jsonb_typeof(v.snapshot->'rotinas')='array' then v.snapshot->'rotinas' else '[]'::jsonb end) x(item) where item->>'id'=og.rotina_id::text and item->>'alvo_tipo'='grupo' and item->>'grupo_id'=og.grupo_id::text)=1
   and (select count(*) from jsonb_array_elements(case when jsonb_typeof(v.snapshot->'rotinas')='array' then v.snapshot->'rotinas' else '[]'::jsonb end) x(item) where item->>'id'=og.rotina_id::text)=1;
 elsif exists(select 1 from pcm.sso_vinculos_visita_legado vinc where vinc.ocorrencia_legada_id=v_legada and vinc.cliente_id=p_cliente_id) then$new$;
begin
 select pg_catalog.pg_get_functiondef('pcm.sso_prever_cobertura_perguntas(uuid,uuid,integer,integer)'::regprocedure) into v_def;
 if position(v_antigo in v_def)=0 then raise exception 'previa_cobertura_definicao_incompativel' using errcode='55000'; end if;
 execute replace(v_def,v_antigo,v_novo);
end;
$migration$;
revoke all on function pcm.sso_prever_cobertura_perguntas(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
