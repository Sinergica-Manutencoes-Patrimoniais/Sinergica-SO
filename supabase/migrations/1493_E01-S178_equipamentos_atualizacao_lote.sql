-- ADR-1343: amplia os tipos aceitos sem mudar o contrato de pedidos anteriores.
do $migration$
declare
 v_func regprocedure;
 v_def text;
 v_antes text := $$not in ('sistema','componente')$$;
 v_depois text := $$not in ('sistema','equipamento','componente')$$;
 v_decl text := 'v_contexto jsonb;v_atributos jsonb;';
 v_decl_nova text := 'v_contexto jsonb;v_atributos jsonb;v_tipo_linha text;';
 v_leitura text := $$select l.atributos into v_atributos from pcm.sso_levantamento_linhas l where l.lote_id=p_lote_id and l.chave=v_item->>'chave';$$;
 v_leitura_nova text := $$select l.atributos,l.tipo into v_atributos,v_tipo_linha from pcm.sso_levantamento_linhas l where l.lote_id=p_lote_id and l.chave=v_item->>'chave';$$;
 v_validacao text := $$if not found or v_atributos is distinct from v_item->'atributos' then raise exception 'linha_divergente' using errcode='40001';end if;$$;
 v_validacao_nova text := $validar$
 if not found or v_atributos is distinct from v_item->'atributos' then raise exception 'linha_divergente' using errcode='40001';end if;
 if (v_item->>'tipo'='sistema' and v_tipo_linha<>'sistema')
   or (v_item->>'tipo' in ('equipamento','componente') and
     (v_tipo_linha not in ('equipamento','componente') or v_item->'snapshot'->>'tipo' is distinct from v_tipo_linha
      or (v_item->>'tipo'<>v_tipo_linha and not (v_item->>'tipo'='componente' and v_tipo_linha='equipamento')))) then
   raise exception 'tipo_divergente' using errcode='23514';end if;$validar$;
begin
 foreach v_func in array array[
  'pcm.sso_atualizar_selecao_levantamento(uuid,uuid,integer,jsonb)'::regprocedure,
  'pcm.sso_atualizar_selecao_levantamento_base_0858(uuid,uuid,integer,jsonb)'::regprocedure
 ] loop
  select pg_catalog.pg_get_functiondef(v_func) into v_def;
  if position(v_antes in v_def)=0 then raise exception 'definicao_lote_incompativel' using errcode='55000';end if;
  v_def:=replace(v_def,v_antes,v_depois);
  if v_func='pcm.sso_atualizar_selecao_levantamento(uuid,uuid,integer,jsonb)'::regprocedure then
    if position(v_decl in v_def)=0 or position(v_leitura in v_def)=0 or position(v_validacao in v_def)=0 then
      raise exception 'definicao_lote_validacao_incompativel' using errcode='55000';end if;
    v_def:=replace(replace(replace(v_def,v_decl,v_decl_nova),v_leitura,v_leitura_nova),v_validacao,v_validacao_nova);
  end if;
  execute v_def;
 end loop;
end;
$migration$;
