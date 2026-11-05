-- ADR-1633: conflitos de conferência não são falhas de serialização.
do $patch$
declare f regprocedure; d text; a text; b text;
begin
 foreach f in array array[
  'pcm.sso_prever_legado_nao_relacionado(uuid,uuid,uuid,uuid,integer)'::regprocedure,
  'pcm.sso_classificar_legado_nao_relacionado(uuid,uuid,uuid,uuid,uuid,integer,text,text,text)'::regprocedure
 ] loop
  d:=pg_catalog.pg_get_functiondef(f);
  a:='f:=pcm.sso_fotografia_legado_nao_relacionado(p_cliente,p_plano,p_legado,p_revisao);';
  b:='begin '||a||' exception when serialization_failure then if sqlerrm = ''plano_ou_revisao_indisponivel'' then raise exception ''plano_ou_revisao_indisponivel'' using errcode=''P0019''; else raise; end if; end;';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'classificacao_legado_incompativel: %',f using errcode='55000';end if;
  d:=replace(d,a,b);
  if f='pcm.sso_classificar_legado_nao_relacionado(uuid,uuid,uuid,uuid,uuid,integer,text,text,text)'::regprocedure then
   a:='raise exception ''revisao_obsoleta'' using errcode=''40001'''; b:='raise exception ''revisao_obsoleta'' using errcode=''P0019''';
   if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'revisao_legado_incompativel' using errcode='55000';end if; d:=replace(d,a,b);
   a:='raise exception ''fotografia_obsoleta'' using errcode=''40001'''; b:='raise exception ''fotografia_obsoleta'' using errcode=''P0019''';
   if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'fotografia_legado_incompativel' using errcode='55000';end if; d:=replace(d,a,b);
  end if;
  execute d;
 end loop;
end; $patch$;
