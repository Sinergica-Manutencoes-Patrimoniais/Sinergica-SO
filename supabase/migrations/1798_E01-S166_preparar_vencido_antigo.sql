-- ADR-1656: mantém preparação unitária e remove somente limite de idade.
do $patch$
declare
  d text := pg_catalog.pg_get_functiondef('pcm.sso_preparar_ciclo_vencido(uuid,uuid,uuid,uuid,uuid,integer,date)'::regprocedure);
  a text := 'if p_vencimento >= v_hoje or p_vencimento < v_hoje - 366 then';
  b text := 'if p_vencimento >= v_hoje then';
begin
  if (length(d)-length(replace(d,a,'')))/length(a) <> 1 then
    raise exception 'preparacao_vencido_incompativel' using errcode='55000';
  end if;
  execute replace(d,a,b);
end;
$patch$;
