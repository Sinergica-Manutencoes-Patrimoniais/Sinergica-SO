-- ADR-1557: somente criação nova consulta a versão operacional; não altera a ocorrência.
do $migration$
declare item record;d text;a text;b text;
begin
 for item in select * from (values
 ('pcm.sso_criar_chamado_ciclo_preventivo(uuid,uuid,uuid,uuid)','calendario'),
 ('pcm.sso_criar_chamado_ciclo_visita(uuid,uuid,uuid,uuid)','visita')
 ) x(assinatura,tipo) loop
  d:=pg_catalog.pg_get_functiondef(item.assinatura::regprocedure);
  a:=' v_snapshot jsonb;v_itens jsonb;v_nome text;';
  b:=' v_efetiva jsonb;v_snapshot jsonb;v_itens jsonb;v_nome text;';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'chamado_declaracao_incompativel: %',item.assinatura using errcode='55000';end if;
  d:=replace(d,a,b);
  a:=$a$   select snapshot into v_snapshot from pcm.plano_versoes where id=v_oc.versao_id and plano_id=p_plano_id and estado='aprovado' for share;$a$;
  b:=$b$   lock table pcm.sso_versoes_operacionais_ciclo,pcm.plano_versoes in share mode nowait;
   v_efetiva:=pcm.sso_versao_operacional_ciclo(p_cliente_id,p_plano_id,p_preparada_id,'$b$||item.tipo||$b$');
   v_oc.versao_id:=(v_efetiva->>'versaoId')::uuid;v_oc.rotina_id:=(v_efetiva->>'rotinaId')::uuid;
   select snapshot into v_snapshot from pcm.plano_versoes where id=v_oc.versao_id and plano_id=p_plano_id and estado='aprovado' for share;$b$;
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'chamado_snapshot_incompativel: %',item.assinatura using errcode='55000';end if;
  execute replace(d,a,b);
 end loop;
end; $migration$;
-- CREATE OR REPLACE preserva ACLs existentes.
