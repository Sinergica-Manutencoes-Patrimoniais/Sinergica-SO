-- ADR-1602: revisão divergente é conflito de negócio, não serialização real.
do $patch$
declare
 d text := pg_catalog.pg_get_functiondef('pcm.sso_decidir_impacto_comparado(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,text,jsonb)'::regprocedure);
 a text := $old$raise exception 'revisao_obsoleta' using errcode='40001'$old$;
 b text := $new$raise exception 'revisao_obsoleta' using errcode='P0011'$new$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'decisao_comparada_incompativel' using errcode='55000'; end if;
 execute replace(d,a,b);
end; $patch$;

-- As listas reconsultadas após conflito devem devolver a rejeição prontamente.
do $patch$
declare
 f regprocedure;
 d text;
 a text := $old$raise exception 'revisao_obsoleta' using errcode='40001'$old$;
 b text := $new$raise exception 'revisao_obsoleta' using errcode='P0011'$new$;
begin
 foreach f in array array[
  'pcm.sso_listar_decisoes_calendario_mediada(uuid,uuid,uuid,integer,uuid,integer)'::regprocedure,
  'pcm.sso_listar_decisoes_visita_mediada(uuid,uuid,uuid,integer,uuid,integer)'::regprocedure
 ] loop
  d:=pg_catalog.pg_get_functiondef(f);
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'lista_impacto_incompativel' using errcode='55000'; end if;
  execute replace(d,a,b);
 end loop;
end; $patch$;
