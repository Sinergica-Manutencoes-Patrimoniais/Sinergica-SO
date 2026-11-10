-- ADR-1551: usa versão operacional somente para comandos novos; replays retornam antes do cálculo.
do $migration$
declare d text; a text; b text; item record;
begin
 for item in select * from (values
  ('pcm.sso_materializar_ciclo_legado(uuid,uuid,uuid,uuid,uuid,uuid,text)','calendario'),
  ('pcm.sso_vincular_visita_legado_existente(uuid,uuid,uuid,uuid,uuid,text)','visita'),
  ('pcm.sso_materializar_visita_legado(uuid,uuid,uuid,uuid,uuid,text)','visita')
 ) t(assinatura,tipo) loop
  d:=pg_catalog.pg_get_functiondef(item.assinatura::regprocedure);
  a:='declare v_actor uuid:=auth.uid();'; b:='declare v_efetiva jsonb;v_actor uuid:=auth.uid();';
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'declaracao_legado_incompativel: %',item.assinatura using errcode='55000';end if;
  d:=replace(d,a,b);
  if item.tipo='calendario' then
   a:=$a$if not found or not pcm.sso_plano_permite_gerar_versao(v_plano.id,v_prep.versao_id) then raise exception 'plano_inativo' using errcode='23514';end if;$a$;
   b:=$b$if not found then raise exception 'plano_inativo' using errcode='23514';end if;
 v_efetiva:=pcm.sso_versao_operacional_ciclo(p_cliente_id,v_plano.id,v_prep.id,'calendario');
 v_prep.versao_id:=(v_efetiva->>'versaoId')::uuid;v_prep.rotina_id:=(v_efetiva->>'rotinaId')::uuid;
 if not pcm.sso_plano_permite_gerar_versao(v_plano.id,v_prep.versao_id) then raise exception 'plano_inativo' using errcode='23514';end if;$b$;
  else
   a:=$a$if not found or v_plano.estado not in ('aprovado','ativo') then raise exception 'plano_inativo' using errcode='23514';end if;$a$;
   b:=$b$if not found or v_plano.estado not in ('aprovado','ativo') then raise exception 'plano_inativo' using errcode='23514';end if;
 v_efetiva:=pcm.sso_versao_operacional_ciclo(p_cliente_id,v_plano.id,v_prep.id,'visita');
 v_prep.versao_id:=(v_efetiva->>'versaoId')::uuid;v_prep.rotina_id:=(v_efetiva->>'rotinaId')::uuid;$b$;
  end if;
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'origem_legado_incompativel: %',item.assinatura using errcode='55000';end if;
  execute replace(d,a,b);
 end loop;
end; $migration$;

-- CREATE OR REPLACE preserva ACLs existentes, inclusive grant autenticado de 0935.
