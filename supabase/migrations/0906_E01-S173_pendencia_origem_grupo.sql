-- ADR-0681: origem aditiva exclusiva; 0903 continua bloqueando escrita Grupo.
alter table pcm.sso_pendencias_tecnicas add column ocorrencia_grupo_id uuid references pcm.sso_ocorrencias_grupo(id);
alter table pcm.sso_pendencias_tecnicas alter column ocorrencia_id drop not null;
alter table pcm.sso_pendencias_tecnicas add constraint sso_pendencia_origem_exclusiva check ((ocorrencia_id is null) <> (ocorrencia_grupo_id is null));
do $migration$
declare v_def text;
 v_antigo text:=$old$  if exists(select 1 from pcm.sso_vinculos_visita_legado v where v.ocorrencia_legada_id=v_ocorrencia and v.cliente_id=v_retorno.cliente_id) then$old$;
 v_novo text:=$new$  if exists(select 1 from pcm.sso_vinculos_os_grupo vg where vg.os_id=v_retorno.os_id and vg.cliente_id=v_retorno.cliente_id) then
    select og.id into v_ocorrencia_grupo from pcm.sso_vinculos_os_grupo vg
    join pcm.sso_ocorrencias_grupo og on og.id=vg.ocorrencia_grupo_id and og.cliente_id=vg.cliente_id
    join pcm.ordens_servico os on os.id=vg.os_id and os.client_id=vg.cliente_id and os.deleted_at is null and os.ocorrencia_preventiva_id is null and os.chamado_id is null
    join pcm.planos_manutencao plano on plano.id=og.plano_id and plano.cliente_id=vg.cliente_id
    join pcm.plano_versoes versao on versao.id=og.versao_id and versao.plano_id=plano.id and versao.estado='aprovado'
    where vg.os_id=v_retorno.os_id and vg.cliente_id=v_retorno.cliente_id and og.versao_id=v_retorno.versao_id and og.rotina_id=v_retorno.rotina_id
      and v_rotina.alvo_tipo='grupo' and v_rotina.grupo_id=og.grupo_id
      and (select count(*) from jsonb_array_elements(case when jsonb_typeof(versao.snapshot->'rotinas')='array' then versao.snapshot->'rotinas' else '[]'::jsonb end) x(item) where item->>'id'=og.rotina_id::text and item->>'alvo_tipo'='grupo' and item->>'grupo_id'=og.grupo_id::text)=1
      and (select count(*) from jsonb_array_elements(case when jsonb_typeof(versao.snapshot->'rotinas')='array' then versao.snapshot->'rotinas' else '[]'::jsonb end) x(item) where item->>'id'=og.rotina_id::text)=1;
    if not found then raise exception 'origem_grupo_indisponivel' using errcode='23514'; end if;
    v_ocorrencia:=null;
  elsif exists(select 1 from pcm.sso_vinculos_visita_legado v where v.ocorrencia_legada_id=v_ocorrencia and v.cliente_id=v_retorno.cliente_id) then$new$;
 v_guarda text:=$old$  if v_ocorrencia is null or v_rotina.id is null then raise exception 'vinculo_invalido' using errcode='23514'; end if;$old$;
 v_insercao text:=$old$insert into pcm.sso_pendencias_tecnicas(cliente_id,resposta_id,retorno_id,os_id,ocorrencia_id,rotina_id,alvo_tipo,alvo_id,pergunta,observacao)
    values(v_retorno.cliente_id,v_resposta.id,v_retorno.id,v_retorno.os_id,v_ocorrencia,v_rotina.id,v_rotina.alvo_tipo,$old$;
 v_insercao_nova text:=$new$insert into pcm.sso_pendencias_tecnicas(cliente_id,resposta_id,retorno_id,os_id,ocorrencia_id,ocorrencia_grupo_id,rotina_id,alvo_tipo,alvo_id,pergunta,observacao)
    values(v_retorno.cliente_id,v_resposta.id,v_retorno.id,v_retorno.os_id,v_ocorrencia,v_ocorrencia_grupo,v_rotina.id,v_rotina.alvo_tipo,$new$;
begin
 select pg_catalog.pg_get_functiondef('pcm.sso_registrar_pendencia_retorno(uuid,uuid)'::regprocedure) into v_def;
 if position(v_antigo in v_def)=0 or position(v_guarda in v_def)=0 or position(v_insercao in v_def)=0 or position('  v_origem jsonb; v_payload jsonb;' in v_def)=0 then raise exception 'pendencia_definicao_incompativel' using errcode='55000'; end if;
 v_def:=replace(v_def,'  v_origem jsonb; v_payload jsonb;','  v_ocorrencia_grupo uuid; v_origem jsonb; v_payload jsonb;');
 v_def:=replace(v_def,v_antigo,v_novo);
 v_def:=replace(v_def,v_guarda,'  if (v_ocorrencia is null) = (v_ocorrencia_grupo is null) or v_rotina.id is null then raise exception ''vinculo_invalido'' using errcode=''23514''; end if;');
 v_def:=replace(v_def,v_insercao,v_insercao_nova);
 execute v_def;
end;
$migration$;
revoke all on function pcm.sso_registrar_pendencia_retorno(uuid,uuid) from public,anon,authenticated,service_role;
