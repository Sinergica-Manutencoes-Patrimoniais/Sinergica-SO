-- ADR-1502: entradas históricas seguem o protocolo somente quando a continuidade estiver ativa.
do $migracao$
declare v_item record;d text;p integer;
begin
 for v_item in select * from (values
 ('pcm.sso_listar_visitas_integracao_legado(uuid,uuid,uuid,uuid,uuid,integer)',false),
 ('pcm.sso_materializar_visita_legado(uuid,uuid,uuid,uuid,uuid,text)',true),
 ('pcm.sso_materializar_lote_visita_legado(uuid,uuid,uuid,uuid,uuid,jsonb,text)',true)
 ) t(assinatura,escrita) loop
  d:=pg_catalog.pg_get_functiondef(v_item.assinatura::regprocedure);p:=strpos(d,E'\nbegin\n');
  if p=0 or strpos(d,'sso_exigir_visita_ponte')>0 then raise exception 'definicao_rpc_visita_incompativel: %',v_item.assinatura using errcode='55000';end if;
  d:=overlay(d placing E'\nbegin\n if exists(select 1 from pcm.sso_continuidade_revisao_gate g where g.id and g.habilitado) then perform pcm.sso_exigir_visita_ponte(auth.uid(),p_cliente_id,'||case when v_item.escrita then 'true' else 'false' end||E');end if;\n' from p for length(E'\nbegin\n'));
  execute d;
 end loop;
end; $migracao$;
