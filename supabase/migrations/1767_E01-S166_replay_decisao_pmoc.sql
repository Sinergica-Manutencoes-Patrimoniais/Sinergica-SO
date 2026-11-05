-- ADR-1625: o replay devolve o mesmo contrato da resposta original.
do $patch$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_decidir_proposta_pmoc(uuid,uuid,uuid,integer,text,text,text)'::regprocedure);
 a text:=$a$return jsonb_build_object('decisaoId',v_existente.id,'revision',v_existente.revisao,'state',v_existente.decisao,'requestId',p_request_id);$a$;
 b text:=$b$return jsonb_build_object('decisaoId',v_existente.id,'revision',v_existente.revisao,'state',v_existente.decisao,'requestId',p_request_id,'deduplicacaoAtiva',false);$b$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'replay_decisao_pmoc_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $patch$;
