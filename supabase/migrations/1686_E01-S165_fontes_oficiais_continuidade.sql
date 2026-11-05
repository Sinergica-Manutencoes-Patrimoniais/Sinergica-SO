-- ADR-1543: Visita SSO não precisa de ponte legada; legado existente precisa de classificação.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_registrar_continuidades_aprovadas()'::regprocedure);
 a text:=$antes$  or (v_visitas->>'visitasSemPonteLegada')::bigint is distinct from 0$antes$;
 b text:=$depois$  or (v_visitas->>'planosClienteSemRelacaoDeclarada')::bigint is distinct from 0$depois$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 or position(b in d)>0 then
  raise exception 'definicao_continuidade_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;
