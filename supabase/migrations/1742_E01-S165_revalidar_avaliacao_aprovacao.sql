-- ADR-1600: avaliação tardia invalida a comparação usada na aprovação.
do $patch$
declare d text; a text; b text;
begin
 d:=pg_catalog.pg_get_functiondef('pcm.sso_fotografia_os_comparacao_aprovacao(uuid,uuid,uuid,text)'::regprocedure);
 a:=$a$ return jsonb_build_object('osImpacto',v_os,'osOutroCliente',v_outros>0);$a$;
 b:=$b$ lock table pcm.avaliacoes_preventivas in share mode nowait;
 return jsonb_build_object('osImpacto',v_os,'osOutroCliente',v_outros>0)||case when exists(select 1 from pcm.avaliacoes_preventivas av where av.ocorrencia_id=v_legada) then jsonb_build_object('avaliacaoLegadaExistente',true) else '{}'::jsonb end;$b$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'fotografia_aprovacao_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
 d:=pg_catalog.pg_get_functiondef('pcm.sso_exigir_comparacao_questionario_aprovacao()'::regprocedure);
 a:=$a$   raise exception 'comparacao_os_obsoleta' using errcode='23514';end if;$a$;
 b:=$b$   raise exception 'comparacao_os_obsoleta' using errcode='23514';end if;
  if v_item.comparacao->'avaliacaoLegadaExistente' is distinct from v_atual->'avaliacaoLegadaExistente' then
   raise exception 'comparacao_avaliacao_obsoleta' using errcode='23514';end if;$b$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'validador_aprovacao_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $patch$;
