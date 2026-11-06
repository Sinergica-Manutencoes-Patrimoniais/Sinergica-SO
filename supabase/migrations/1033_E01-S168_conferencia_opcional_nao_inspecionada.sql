-- ADR-0845: guarda de cobertura anterior distingue opcionais explicitamente.
do $migration$
declare
 v_def text;
 v_antigo text := $old$ or exists(select 1 from pcm.respostas_os_preparadas r where r.retorno_id=p_retorno_id and r.resultado='nao_inspecionado')$old$;
begin
 select pg_catalog.pg_get_functiondef('pcm.sso_conferir_cobertura_retorno(uuid,uuid,uuid,uuid,integer,text)'::regprocedure) into v_def;
 if position(v_antigo in v_def)=0 or (length(v_def)-length(replace(v_def,v_antigo,''))) / length(v_antigo) <> 1 then
   raise exception 'conferencia_definicao_incompativel' using errcode='55000';
 end if;
 execute replace(v_def,v_antigo,'');
end;
$migration$;
revoke all on function pcm.sso_conferir_cobertura_retorno(uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
