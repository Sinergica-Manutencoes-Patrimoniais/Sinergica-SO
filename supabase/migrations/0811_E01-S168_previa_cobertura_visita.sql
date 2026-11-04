-- ADR-0586: leitura de cobertura por origem Visita, sem autorizar validação.
do $migration$
declare
 v_def text;
 v_antigo text := $old$ select v.snapshot into v_snapshot from pcm.ordens_servico os join pcm.ocorrencias_rotina_vinculos vinc on vinc.ocorrencia_legada_id=os.ocorrencia_preventiva_id join pcm.ocorrencias_rotina_preparadas oc on oc.id=vinc.ocorrencia_preparada_id
 join pcm.planos_manutencao p on p.id=oc.plano_id and p.cliente_id=p_cliente_id join pcm.plano_versoes v on v.id=oc.versao_id and v.plano_id=p.id and v.estado='aprovado'
 where os.id=v_retorno.os_id and os.client_id=p_cliente_id and os.deleted_at is null and oc.versao_id=v_retorno.versao_id and oc.rotina_id=v_retorno.rotina_id;$old$;
 v_novo text := $new$ select os.ocorrencia_preventiva_id into v_legada from pcm.ordens_servico os where os.id=v_retorno.os_id and os.client_id=p_cliente_id and os.deleted_at is null;
 if exists(select 1 from pcm.sso_vinculos_visita_legado vinc where vinc.ocorrencia_legada_id=v_legada and vinc.cliente_id=p_cliente_id) then
   v_origem:=pcm.sso_resolver_origem_execucao(p_cliente_id,v_legada);
   if v_origem->>'tipo' is distinct from 'visita' or v_origem->>'versaoId' is distinct from v_retorno.versao_id::text or v_origem->>'rotinaId' is distinct from v_retorno.rotina_id::text then raise exception 'vinculo_nao_comprovado' using errcode='23514'; end if;
   select v.snapshot into v_snapshot from pcm.plano_versoes v where v.id=v_retorno.versao_id and v.plano_id=(v_origem->>'planoId')::uuid and v.estado='aprovado';
 else
   select v.snapshot into v_snapshot from pcm.ordens_servico os join pcm.ocorrencias_rotina_vinculos vinc on vinc.ocorrencia_legada_id=os.ocorrencia_preventiva_id join pcm.ocorrencias_rotina_preparadas oc on oc.id=vinc.ocorrencia_preparada_id
   join pcm.planos_manutencao p on p.id=oc.plano_id and p.cliente_id=p_cliente_id join pcm.plano_versoes v on v.id=oc.versao_id and v.plano_id=p.id and v.estado='aprovado'
   where os.id=v_retorno.os_id and os.client_id=p_cliente_id and os.deleted_at is null and oc.versao_id=v_retorno.versao_id and oc.rotina_id=v_retorno.rotina_id;
 end if;$new$;
begin
 select pg_catalog.pg_get_functiondef('pcm.sso_prever_cobertura_perguntas(uuid,uuid,integer,integer)'::regprocedure) into v_def;
 if position(v_antigo in v_def)=0 or position('declare v_retorno pcm.retorno_os_preparado%rowtype;' in v_def)=0 then raise exception 'previa_cobertura_definicao_incompativel' using errcode='55000'; end if;
 v_def:=replace(v_def,'declare v_retorno pcm.retorno_os_preparado%rowtype;','declare v_origem jsonb; v_legada uuid; v_retorno pcm.retorno_os_preparado%rowtype;');
 v_def:=replace(v_def,v_antigo,v_novo);
 execute v_def;
end;
$migration$;
revoke all on function pcm.sso_prever_cobertura_perguntas(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
