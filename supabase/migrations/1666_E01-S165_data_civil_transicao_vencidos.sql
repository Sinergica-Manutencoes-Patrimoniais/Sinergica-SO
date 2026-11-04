-- ADR-1523: mesma data civil para decisões de Plano e geração. Sem novo gate.
create function pcm.sso_data_civil_transicao_plano(p_plano uuid,p_versao uuid,p_vigencia date)
returns date language plpgsql volatile security definer set search_path='' as $$
declare v_gate_data boolean;v_gate_snapshot boolean;v_versao uuid;v_total bigint;
begin
 select habilitado into v_gate_data from pcm.sso_data_civil_geracao_gate where id for share;
 if not found then raise exception 'configuracao_data_indisponivel' using errcode='55000';end if;
 select habilitado into v_gate_snapshot from pcm.sso_snapshot_fuso_plano_gate where id for share;
 if not found then raise exception 'configuracao_fuso_indisponivel' using errcode='55000';end if;
 if not v_gate_data and not v_gate_snapshot then return (pg_catalog.transaction_timestamp() at time zone 'America/Sao_Paulo')::date;end if;
 if not v_gate_data or not v_gate_snapshot then raise exception 'configuracao_fuso_incompleta' using errcode='55000';end if;
 if p_plano is null or p_vigencia is null or not isfinite(p_vigencia) then raise exception 'vigencia_invalida' using errcode='22023';end if;
 if p_versao is null then
  select count(*),min(id::text)::uuid into v_total,v_versao from pcm.plano_versoes
   where plano_id=p_plano and estado='aprovado' and vigencia_inicio<=p_vigencia and (vigencia_fim is null or vigencia_fim>=p_vigencia);
  if v_total<>1 then raise exception 'vigencia_indeterminada' using errcode='23514';end if;
 else
  v_versao:=p_versao;
 end if;
 return pcm.sso_data_civil_versao_geracao(p_plano,v_versao);
end; $$;
revoke all on function pcm.sso_data_civil_transicao_plano(uuid,uuid,date) from public,anon,authenticated,service_role;

do $migracao$
declare v_item record;d text;a text;b text;
begin
 for v_item in select * from (values
  ('pcm.sso_transicionar_plano_preparado(uuid,uuid,integer,text,date,text)','p_vigencia<>current_date','p_vigencia<>pcm.sso_data_civil_transicao_plano(p_plano_id,null,p_vigencia)'),
  ('pcm.sso_retomar_plano_preparado(uuid,uuid,integer,date,text)','p_vigencia<>current_date','p_vigencia<>pcm.sso_data_civil_transicao_plano(p_plano_id,null,p_vigencia)'),
  ('pcm.sso_registrar_decisao_vencimento(uuid,uuid,uuid,integer,uuid,uuid,integer,date,text,text)','p_vencimento>=current_date','p_vencimento>=pcm.sso_data_civil_transicao_plano(p_plano_id,p_versao_id,p_vencimento)')
 ) t(assinatura,antes,depois) loop
  d:=pg_catalog.pg_get_functiondef(v_item.assinatura::regprocedure);a:=v_item.antes;b:=v_item.depois;
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'definicao_transicao_incompativel: %',v_item.assinatura using errcode='55000';end if;
  execute replace(d,a,b);
 end loop;
end; $migracao$;
