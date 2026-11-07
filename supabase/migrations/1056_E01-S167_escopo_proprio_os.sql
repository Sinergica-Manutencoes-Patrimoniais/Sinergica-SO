-- ADR-0869. Retira apenas a igualdade título/descrição com o Chamado, mantendo demais guardas.
do $$
declare
  v_funcao regprocedure := 'pcm.sso_converter_chamado_integral(uuid,bigint,uuid,uuid,uuid,jsonb,text,text)'::regprocedure;
  v_definicao text := pg_catalog.pg_get_functiondef(v_funcao);
  v_trecho text := ' or btrim(v_os.titulo) is distinct from btrim(v_c.titulo) or v_os.descricao is distinct from nullif(btrim(v_c.descricao),'''')';
  v_alterada text;
begin
  if pg_catalog.strpos(v_definicao,v_trecho)=0 or
    (pg_catalog.length(v_definicao)-pg_catalog.length(pg_catalog.replace(v_definicao,v_trecho,''))) <> pg_catalog.length(v_trecho) then
    raise exception 'definicao_conversao_integral_incompativel' using errcode='55000';
  end if;
  v_alterada := pg_catalog.replace(v_definicao,v_trecho,'');
  execute v_alterada;
end;
$$;
