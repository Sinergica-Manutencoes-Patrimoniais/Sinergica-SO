-- ADR-1597: evidência vinculada integra a comparação e seu CAS.
do $patch$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_comparar_rotina_impacto_v3(uuid,uuid,uuid,integer,uuid,uuid,text)'::regprocedure);
 a text:=$a$ if v_count>100 then raise exception 'os_excedem_limite_reconciliacao' using errcode='23514';end if;$a$;
 b text:=$b$ lock table pcm.avaliacoes_preventivas in share mode nowait;
 if exists(select 1 from pcm.avaliacoes_preventivas av where av.ocorrencia_id=v_legada) then
  v_base:=v_base||jsonb_build_object('avaliacaoLegadaExistente',true);
 end if;
 if v_count>100 then raise exception 'os_excedem_limite_reconciliacao' using errcode='23514';end if;$b$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'comparacao_impacto_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $patch$;
