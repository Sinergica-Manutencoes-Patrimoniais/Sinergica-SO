-- ADR-1547: preserva coordenação 1592, adicionando Visita fotografada à barreira.
do $migration$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_bloquear_consumidor_visita_nao_integrado()'::regprocedure);
 a text:=$a$select exists(select 1 from pcm.ordens_servico os join pcm.sso_vinculos_visita_legado v on v.ocorrencia_legada_id=os.ocorrencia_preventiva_id where os.id=v_os_id and os.client_id=v.cliente_id),$a$;
 b text:=$b$select (exists(select 1 from pcm.ordens_servico os join pcm.sso_vinculos_visita_legado v on v.ocorrencia_legada_id=os.ocorrencia_preventiva_id where os.id=v_os_id and os.client_id=v.cliente_id)
   or exists(select 1 from pcm.sso_origens_os_preventiva f where f.os_id=v_os_id and f.tipo='visita')),$b$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'guarda_visita_fotografia_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migration$;
revoke all on function pcm.sso_bloquear_consumidor_visita_nao_integrado() from public,anon,authenticated,service_role;
