-- ADR-0811: comando separado; 0366 não é modificado. Não comprova bytes no SQL.
create function pcm.sso_realizar_despesa_ingestao(p_request_id uuid,p_despesa_id uuid,p_expected_revision integer,p_realizado_centavos bigint,p_comprovante_objeto_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ator uuid:=auth.uid(); v_despesa pcm.despesas_visita%rowtype; v_res pcm.sso_ingestao_comprovante_reservas%rowtype; v_comando pcm.despesa_visita_comandos%rowtype; v_gate boolean; v_payload jsonb; v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if v_ator is null or p_request_id is null or p_despesa_id is null or p_expected_revision is null or p_expected_revision<1 or p_realizado_centavos is null or p_realizado_centavos not between 0 and 9007199254740991 or p_comprovante_objeto_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 select habilitado into v_gate from pcm.sso_ingestao_comprovante_gate where id for share; if not coalesce(v_gate,false) then raise exception 'ingestao_desabilitada' using errcode='55000'; end if;
 select habilitado into v_gate from pcm.sso_upload_comprovante_gate where id for share; if not coalesce(v_gate,false) then raise exception 'ingestao_desabilitada' using errcode='55000'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-ingestao-comprovante:'||p_request_id::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('despesa-visita-request:'||p_request_id::text,0));
 select * into v_despesa from pcm.despesas_visita where id=p_despesa_id for update;
 if not found or config.sso_autorizar_acao('despesa_visita.gerir',v_despesa.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select r.* into v_res from pcm.sso_ingestao_comprovante_reservas r join pcm.sso_ingestao_comprovante_confirmacoes c on c.request_id=r.request_id
   where r.request_id=p_request_id and r.ator_id=v_ator and r.cliente_id=v_despesa.cliente_id and r.despesa_id=p_despesa_id and c.objeto_id=p_comprovante_objeto_id;
 if not found then raise exception 'comprovante_nao_confirmado' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('operacao','realizar','despesaId',p_despesa_id,'expectedRevision',p_expected_revision,'realizadoCentavos',p_realizado_centavos,'comprovanteObjetoId',p_comprovante_objeto_id);
 select * into v_comando from pcm.despesa_visita_comandos where request_id=p_request_id;
 if found then if v_comando.actor_id is distinct from v_ator or v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return v_comando.resultado; end if;
 if v_despesa.revisao<>p_expected_revision then raise exception 'revisao_divergente' using errcode='40001'; end if;
 if v_despesa.status<>'ativa' or v_despesa.realizado_centavos is not null then raise exception 'estado_invalido' using errcode='23514'; end if;
 perform 1 from storage.objects o join storage.buckets b on b.id=o.bucket_id where o.id=p_comprovante_objeto_id and o.name=v_res.caminho and o.bucket_id='sso-despesas-visita' and b.public is false for share of o;
 if not found then raise exception 'comprovante_indisponivel' using errcode='42501'; end if;
 update pcm.despesas_visita set realizado_centavos=p_realizado_centavos,revisao=revisao+1 where id=p_despesa_id returning * into v_despesa;
 insert into pcm.despesa_visita_realizacoes(despesa_id,revisao,valor_centavos,comprovante_objeto_id,comprovante_caminho,ator_id,request_id) values(p_despesa_id,v_despesa.revisao,p_realizado_centavos,p_comprovante_objeto_id,v_res.caminho,v_ator,p_request_id);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'despesa_visita.realizada','despesas_visita',p_despesa_id,jsonb_build_object('requestId',p_request_id,'clienteId',v_despesa.cliente_id,'revision',v_despesa.revisao));
 v_resultado:=jsonb_build_object('aggregateId',p_despesa_id,'revision',v_despesa.revisao,'state','ativa','created',false,'linkedIds',jsonb_build_object('visitaId',v_despesa.visita_id),'warnings','[]'::jsonb,'requestId',p_request_id);
 insert into pcm.despesa_visita_comandos(request_id,actor_id,cliente_id,payload,resultado) values(p_request_id,v_ator,v_despesa.cliente_id,v_payload,v_resultado);
 return v_resultado;
end $$;
revoke all on function pcm.sso_realizar_despesa_ingestao(uuid,uuid,integer,bigint,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_realizar_despesa_ingestao(uuid,uuid,integer,bigint,uuid) to authenticated;
