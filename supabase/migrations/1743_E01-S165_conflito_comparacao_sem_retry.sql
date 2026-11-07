-- ADR-1601: conflito de fotografia é rejeição definitiva, não erro de serialização.
do $patch$
declare
 d text := pg_catalog.pg_get_functiondef('pcm.sso_decidir_impacto_comparado(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,text,jsonb)'::regprocedure);
 a text := $old$raise exception 'comparacao_obsoleta' using errcode='40001'$old$;
 b text := $new$raise exception 'comparacao_obsoleta' using errcode='P0010'$new$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'decisao_comparada_incompativel' using errcode='55000'; end if;
 execute replace(d,a,b);
end; $patch$;
