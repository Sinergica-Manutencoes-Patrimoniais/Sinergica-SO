-- ADR-0646: identifica origem de novas fotografias, sem reescrever histórico.
do $migration$
declare v_def text;v_antigo text:=$old$'fotografiaCongeladaNaAprovacao',false,'historicoRecalculado',false$old$;
 v_novo text:=$new$'fotografiaCongeladaNaAprovacao',exists(select 1 from pcm.sso_origens_quantidade_grupo f where f.ocorrencia_id=v_ocorrencia.id),
 'quantidadeAtualNoRegistro',(select f.quantidade_atual_registro::text from pcm.sso_origens_quantidade_grupo f where f.ocorrencia_id=v_ocorrencia.id),
 'revisaoAtualNoRegistro',(select f.revisao_atual_registro from pcm.sso_origens_quantidade_grupo f where f.ocorrencia_id=v_ocorrencia.id),
 'historicoRecalculado',false$new$;
begin
 select pg_catalog.pg_get_functiondef('pcm.sso_comparar_quantidade_grupo(uuid,uuid)'::regprocedure) into v_def;
 if position(v_antigo in v_def)=0 then raise exception 'comparacao_grupo_definicao_incompativel' using errcode='55000'; end if;
 execute replace(v_def,v_antigo,v_novo);
end;
$migration$;
revoke all on function pcm.sso_comparar_quantidade_grupo(uuid,uuid) from public,anon,authenticated,service_role;
