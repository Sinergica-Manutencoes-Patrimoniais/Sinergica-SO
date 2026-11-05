-- ADR-1647: somente leitura; ausência permanece indeterminada.
create function pcm.sso_consultar_recibo_preparacao_visita_anterior(
 p_ator uuid,p_cliente uuid,p_request uuid,p_ocorrencia uuid,p_plano uuid,
 p_versao uuid,p_rotina uuid,p_visita uuid,p_revisao integer,p_fonte text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_comando pcm.calendario_contratual_comandos%rowtype;v_payload jsonb;
begin
 perform pcm.sso_serializar_autorizacao_rotina();
 if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null
  or config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true
  or config.sso_autorizar_acao('visita.confirmar',p_cliente) is distinct from true then
  raise exception 'sem_acesso' using errcode='42501';
 end if;
 if p_request is null or p_ocorrencia is null or p_plano is null or p_versao is null or p_rotina is null or p_visita is null
  or p_revisao is null or p_revisao<1 or nullif(btrim(p_fonte),'') is null or length(btrim(p_fonte))>500 then
  raise exception 'consulta_invalida' using errcode='22023';
 end if;
 perform 1 from pcm.planos_manutencao p where p.id=p_plano and p.cliente_id=p_cliente for share nowait;
 if not found then raise exception 'sem_acesso' using errcode='42501';end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('calendario-request:'||p_request::text,0)) then
  raise exception 'pedido_em_processamento' using errcode='55P03';
 end if;
 select * into v_comando from pcm.calendario_contratual_comandos where request_id=p_request;
 if not found then return jsonb_build_object('encontrado',false);end if;
 v_payload:=jsonb_build_object('tipo','prepararOcorrenciaVisita','ocorrenciaId',p_ocorrencia,'planoId',p_plano,'versaoId',p_versao,
  'rotinaId',p_rotina,'visitaId',p_visita,'expectedRevision',p_revisao,'fonteDiaUtil',btrim(p_fonte));
 if v_comando.actor_id is distinct from p_ator or v_comando.cliente_id is distinct from p_cliente or v_comando.payload is distinct from v_payload then
  raise exception 'recibo_nao_corresponde' using errcode='42501';
 end if;
 return jsonb_build_object('encontrado',true,'resultado',v_comando.resultado);
end; $$;
revoke all on function pcm.sso_consultar_recibo_preparacao_visita_anterior(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_recibo_preparacao_visita_anterior(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,text) to authenticated;
