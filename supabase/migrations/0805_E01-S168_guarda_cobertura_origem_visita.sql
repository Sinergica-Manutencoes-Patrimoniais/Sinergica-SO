-- ADR-0580: prepara a guarda de cobertura para origem Visita; 0729 segue fechada.
do $migration$
declare
 v_def text;
 v_antigo text := $old$ select v.snapshot into v_snapshot from pcm.ordens_servico os join pcm.ocorrencias_rotina_vinculos vinc on vinc.ocorrencia_legada_id=os.ocorrencia_preventiva_id
 join pcm.ocorrencias_rotina_preparadas ocorr on ocorr.id=vinc.ocorrencia_preparada_id join pcm.planos_manutencao plano on plano.id=ocorr.plano_id
 join pcm.plano_versoes v on v.id=ocorr.versao_id and v.plano_id=plano.id
 where os.id=v_retorno.os_id and os.client_id=v_retorno.cliente_id and os.deleted_at is null and plano.cliente_id=v_retorno.cliente_id
 and ocorr.versao_id=v_retorno.versao_id and ocorr.rotina_id=v_retorno.rotina_id and v.estado='aprovado';$old$;
 v_novo text := $new$ select os.ocorrencia_preventiva_id into v_ocorrencia_legada from pcm.ordens_servico os
 where os.id=v_retorno.os_id and os.client_id=v_retorno.cliente_id and os.deleted_at is null;
 if exists(select 1 from pcm.sso_vinculos_visita_legado vinc where vinc.ocorrencia_legada_id=v_ocorrencia_legada and vinc.cliente_id=v_retorno.cliente_id) then
   v_origem:=pcm.sso_resolver_origem_execucao(v_retorno.cliente_id,v_ocorrencia_legada);
   if v_origem->>'tipo' is distinct from 'visita' or v_origem->>'versaoId' is distinct from v_retorno.versao_id::text
      or v_origem->>'rotinaId' is distinct from v_retorno.rotina_id::text then
     raise exception 'vinculo_os_versao_nao_comprovado' using errcode='23514';
   end if;
   select v.snapshot into v_snapshot from pcm.plano_versoes v
   where v.id=v_retorno.versao_id and v.plano_id=(v_origem->>'planoId')::uuid and v.estado='aprovado';
 else
   select v.snapshot into v_snapshot from pcm.ordens_servico os join pcm.ocorrencias_rotina_vinculos vinc on vinc.ocorrencia_legada_id=os.ocorrencia_preventiva_id
   join pcm.ocorrencias_rotina_preparadas ocorr on ocorr.id=vinc.ocorrencia_preparada_id join pcm.planos_manutencao plano on plano.id=ocorr.plano_id
   join pcm.plano_versoes v on v.id=ocorr.versao_id and v.plano_id=plano.id
   where os.id=v_retorno.os_id and os.client_id=v_retorno.cliente_id and os.deleted_at is null and plano.cliente_id=v_retorno.cliente_id
   and ocorr.versao_id=v_retorno.versao_id and ocorr.rotina_id=v_retorno.rotina_id and v.estado='aprovado';
 end if;$new$;
begin
 select pg_catalog.pg_get_functiondef('pcm.sso_guardar_cobertura_validacao_os()'::regprocedure) into v_def;
 if position(v_antigo in v_def)=0 or position('declare v_retorno pcm.retorno_os_preparado%rowtype;' in v_def)=0 then
   raise exception 'guarda_cobertura_definicao_incompativel' using errcode='55000';
 end if;
 v_def:=replace(v_def,'declare v_retorno pcm.retorno_os_preparado%rowtype;','declare v_origem jsonb; v_ocorrencia_legada uuid; v_retorno pcm.retorno_os_preparado%rowtype;');
 v_def:=replace(v_def,v_antigo,v_novo);
 execute v_def;
end;
$migration$;
revoke all on function pcm.sso_guardar_cobertura_validacao_os() from public,anon,authenticated,service_role;
