-- ADR-1591: estado operacional deriva da guarda vigente, não da igualdade de toda a fotografia histórica.
create or replace function pcm.sso_consultar_declaracao_legada_sso(p_ator uuid,p_cliente uuid,p_plano uuid,p_legada uuid,p_escolha uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_foto jsonb;v pcm.sso_declaracoes_legada_inerte%rowtype;v_res jsonb;v_integrada boolean:=false;
begin
 v_foto:=pcm.sso_prever_reconciliacao_legada_sso(p_ator,p_cliente,p_plano,p_legada,p_escolha)->'foto';
 select * into v from pcm.sso_declaracoes_legada_inerte where cliente_id=p_cliente and plano_id=p_plano and legada_id=p_legada and escolha_request_id=p_escolha order by sequencia desc limit 1;
 if not found then return jsonb_build_object('registrada',false,'fotoAtual',v_foto,'integracaoAtual',false,'integracaoOperacionalPendente',false);end if;
 begin
  v_res:=pcm.sso_reserva_rascunho_vigente((v_foto->>'legadoId')::uuid,(v_foto->>'indice')::integer,null,null);
  v_integrada:=v_res->>'escolhaRequestId'=p_escolha::text and v_res->>'clienteId'=p_cliente::text and v_res->>'planoId'=p_plano::text and v_res->>'decisao'='somente_sso';
 exception when check_violation then v_integrada:=false;
 end;
 return jsonb_build_object('registrada',true,'fotoAtual',v_foto,'fotografiaAtual',v.fotografia is not distinct from v_foto,
  'integracaoAtual',coalesce(v_integrada,false),'requestId',v.request_id,'motivo',v.motivo,'registradaEm',v.criado_em,'integracaoOperacionalPendente',false);
end; $$;
revoke all on function pcm.sso_consultar_declaracao_legada_sso(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_declaracao_legada_sso(uuid,uuid,uuid,uuid,uuid) to authenticated;
