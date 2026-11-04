-- ADR-1485: conferir versão apenas antes de criar Chamado novo.
do $migracao$
declare v_item record;v_def text;v_antes text;v_depois text;
begin
 for v_item in select * from (values
 ('pcm.sso_criar_chamado_ciclo_preventivo(uuid,uuid,uuid,uuid)','calendario'),
 ('pcm.sso_criar_chamado_ciclo_visita(uuid,uuid,uuid,uuid)','visita')
 ) t(assinatura,tipo) loop
  v_def:=pg_catalog.pg_get_functiondef(v_item.assinatura::regprocedure);
  if v_item.tipo='calendario' then v_antes:=$antes$   if exists(select 1 from pcm.sso_fila_preventiva_pcm where ciclo_id=v_ciclo and estado='cancelado')$antes$;
  else v_antes:=$antes$   if exists(select 1 from pcm.sso_ciclo_visita_versoes cv join pcm.sso_vinculos_visita_legado ponte$antes$; end if;
  v_depois:='   perform pcm.sso_exigir_vigencia_ocorrencia_legada(p_cliente_id,p_preparada_id,'''||v_item.tipo||''');'||E'\n'||v_antes;
  if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>1 then raise exception 'definicao_chamado_incompativel: %',v_item.assinatura using errcode='55000'; end if;
  execute replace(v_def,v_antes,v_depois);
 end loop;
end; $migracao$;
