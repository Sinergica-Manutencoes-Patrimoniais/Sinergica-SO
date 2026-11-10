-- ADR-0843: preserva segurança quando não existe um contrato explícito e único.
do $migration$
declare
  v_def text;
  v_antigo text := $old$select gen_random_uuid(),p_retorno_id,item->>'perguntaId',item->>'resultado',true,nullif(btrim(item->>'observacao'),'')$old$;
  v_novo text := $new$select gen_random_uuid(),p_retorno_id,x.item->>'perguntaId',x.item->>'resultado',
      not ((select count(*) from jsonb_array_elements(case when jsonb_typeof(v_snapshot->'contratos_perguntas')='array' then v_snapshot->'contratos_perguntas' else '[]'::jsonb end) c(item)
        where c.item->>'rotinaId'=v_ocorrencia.rotina_id::text and c.item->>'questionarioId'=v_rotina->>'questionario_id' and c.item->>'perguntaId'=x.item->>'perguntaId')=1
        and exists(select 1 from jsonb_array_elements(case when jsonb_typeof(v_snapshot->'contratos_perguntas')='array' then v_snapshot->'contratos_perguntas' else '[]'::jsonb end) c(item)
          where c.item->>'rotinaId'=v_ocorrencia.rotina_id::text and c.item->>'questionarioId'=v_rotina->>'questionario_id' and c.item->>'perguntaId'=x.item->>'perguntaId'
            and jsonb_typeof(c.item->'obrigatoria')='boolean' and c.item->>'obrigatoria'='false')),
      nullif(btrim(x.item->>'observacao'),'')$new$;
begin
  select pg_catalog.pg_get_functiondef('pcm.sso_classificar_retorno_campo_manual(uuid,uuid,uuid,uuid,uuid,jsonb)'::regprocedure) into v_def;
  if position(v_antigo in v_def)=0 or (length(v_def)-length(replace(v_def,v_antigo,''))) / length(v_antigo) <> 1 then
    raise exception 'classificador_definicao_incompativel' using errcode='55000';
  end if;
  execute replace(v_def,v_antigo,v_novo);
end;
$migration$;
revoke all on function pcm.sso_classificar_retorno_campo_manual(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
