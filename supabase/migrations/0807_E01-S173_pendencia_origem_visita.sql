-- ADR-0582: prepara identificação da origem Visita; inserção segue bloqueada pela 0729.
do $migration$
declare
 v_def text;
 v_antigo text := $old$  select o.ocorrencia_preventiva_id into v_ocorrencia from pcm.ordens_servico o
    join pcm.ocorrencias_rotina_vinculos v on v.ocorrencia_legada_id=o.ocorrencia_preventiva_id
    join pcm.ocorrencias_rotina_preparadas oc on oc.id=v.ocorrencia_preparada_id
    where o.id=v_retorno.os_id and o.client_id=v_retorno.cliente_id and o.deleted_at is null
      and oc.rotina_id=v_retorno.rotina_id and oc.versao_id=v_retorno.versao_id;$old$;
 v_novo text := $new$  select o.ocorrencia_preventiva_id into v_ocorrencia from pcm.ordens_servico o
    where o.id=v_retorno.os_id and o.client_id=v_retorno.cliente_id and o.deleted_at is null;
  if exists(select 1 from pcm.sso_vinculos_visita_legado v where v.ocorrencia_legada_id=v_ocorrencia and v.cliente_id=v_retorno.cliente_id) then
    v_origem:=pcm.sso_resolver_origem_execucao(v_retorno.cliente_id,v_ocorrencia);
    if v_origem->>'tipo' is distinct from 'visita' or v_origem->>'versaoId' is distinct from v_retorno.versao_id::text
      or v_origem->>'rotinaId' is distinct from v_retorno.rotina_id::text
      or v_origem->>'alvoTipo' is distinct from v_rotina.alvo_tipo::text
      or v_origem->>'alvoId' is distinct from coalesce(v_rotina.sistema_id,v_rotina.equipamento_id,v_rotina.grupo_id)::text then
      raise exception 'vinculo_invalido' using errcode='23514';
    end if;
  else
    select o.ocorrencia_preventiva_id into v_ocorrencia from pcm.ordens_servico o
      join pcm.ocorrencias_rotina_vinculos v on v.ocorrencia_legada_id=o.ocorrencia_preventiva_id
      join pcm.ocorrencias_rotina_preparadas oc on oc.id=v.ocorrencia_preparada_id
      where o.id=v_retorno.os_id and o.client_id=v_retorno.cliente_id and o.deleted_at is null
        and oc.rotina_id=v_retorno.rotina_id and oc.versao_id=v_retorno.versao_id;
  end if;$new$;
begin
 select pg_catalog.pg_get_functiondef('pcm.sso_registrar_pendencia_retorno(uuid,uuid)'::regprocedure) into v_def;
 if position(v_antigo in v_def)=0 or position('  v_payload jsonb; v_resultado jsonb;' in v_def)=0 then
   raise exception 'pendencia_definicao_incompativel' using errcode='55000';
 end if;
 v_def:=replace(v_def,'  v_payload jsonb; v_resultado jsonb;','  v_origem jsonb; v_payload jsonb; v_resultado jsonb;');
 v_def:=replace(v_def,v_antigo,v_novo);
 execute v_def;
end;
$migration$;
revoke all on function pcm.sso_registrar_pendencia_retorno(uuid,uuid) from public,anon,authenticated,service_role;
