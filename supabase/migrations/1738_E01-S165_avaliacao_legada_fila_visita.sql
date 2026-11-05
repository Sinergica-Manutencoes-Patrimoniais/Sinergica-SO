-- ADR-1596: não retirar uma Visita com evidência legada de execução.
do $patch$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_estado_fila_visita_base_1676(uuid,uuid,uuid)'::regprocedure);
 a text:=$a$ select count(*) into v_os from pcm.ordens_servico where ocorrencia_preventiva_id=v_legada;$a$;
 b text:=$b$ lock table pcm.avaliacoes_preventivas in share mode nowait;
 if exists(select 1 from pcm.avaliacoes_preventivas av where av.ocorrencia_id=v_legada) then return 'indeterminado'; end if;
 select count(*) into v_os from pcm.ordens_servico where ocorrencia_preventiva_id=v_legada;$b$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'estado_visita_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $patch$;
