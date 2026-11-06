-- ADR-1598: avaliações recebidas impedem nova ponte de Visita.
do $patch$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_vincular_visita_legado_existente(uuid,uuid,uuid,uuid,uuid,text)'::regprocedure);
 a text:=$a$ if v_leg.origem is distinct from 'legado'$a$;
 b text:=$b$ lock table pcm.avaliacoes_preventivas in share mode nowait;
 if exists(select 1 from pcm.avaliacoes_preventivas av where av.ocorrencia_id=v_leg.id) then raise exception 'legada_exige_reconciliacao' using errcode='23514';end if;
 if v_leg.origem is distinct from 'legado'$b$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'vinculo_visita_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $patch$;
