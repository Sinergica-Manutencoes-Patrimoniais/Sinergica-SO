-- ADR-1605: estado ou revisão obsoleta da fila não é serialização transitória.
do $patch$
declare
 d text := pg_catalog.pg_get_functiondef('pcm.sso_alterar_fila_visita(uuid,uuid,uuid,uuid,text,integer,text)'::regprocedure);
 a text := $old$raise exception 'fila_ou_revisao_indisponivel' using errcode='40001'$old$;
 b text := $new$raise exception 'fila_ou_revisao_indisponivel' using errcode='P0012'$new$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>2 then
  raise exception 'fila_visita_incompativel' using errcode='55000';
 end if;
 execute replace(d,a,b);
end; $patch$;
