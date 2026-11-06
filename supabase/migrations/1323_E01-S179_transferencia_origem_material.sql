-- ADR-1156: transferência local e vínculo de origem, sem operação remota.
create function pcm.sso_transferir_os_por_material(p_request_id uuid,p_intencao_id uuid,p_origem_id uuid,p_destino_id uuid,
 p_vinculo_id uuid,p_novo_vinculo_id uuid,p_revisao_origem integer,p_revisao_destino integer,p_sequencia integer,
 p_motivo text,p_tarefa_esperada text,p_lista_id uuid,p_evento_revisao integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_cliente uuid; v_os uuid; v_lista pcm.listas_materiais%rowtype;
 v_existente pcm.sso_intencao_material_origens%rowtype; v_resultado jsonb;
begin
 if v_actor is null or p_request_id is null or p_origem_id is null or p_destino_id is null or p_lista_id is null
  or p_evento_revisao is null or p_evento_revisao<2 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform 1 from pcm.sso_intencao_material_gate where id and habilitado for share;
 if not found then raise exception 'intencao_material_desabilitada' using errcode='55000'; end if;
 perform pcm.sso_lock_transferencia_composicao(p_request_id,p_origem_id,p_destino_id);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-request:'||p_request_id::text,0));
 select * into v_existente from pcm.sso_intencao_material_origens where request_id=p_request_id;
 if found then
  if v_existente.ator_id is distinct from v_actor or v_existente.lista_id is distinct from p_lista_id
   or v_existente.evento_revisao is distinct from p_evento_revisao or v_existente.intencao_id is distinct from p_intencao_id
   or config.sso_autorizar_acao('material.gerir',v_existente.cliente_id) is distinct from true then
   raise exception 'request_id_conflitante_ou_sem_acesso' using errcode='42501'; end if;
  perform pcm.sso_transferir_os_enviada_conferida(p_request_id,p_intencao_id,p_origem_id,p_destino_id,p_vinculo_id,p_novo_vinculo_id,
   p_revisao_origem,p_revisao_destino,p_sequencia,p_motivo,p_tarefa_esperada);
  return v_existente.resultado;
 end if;
 if exists(select 1 from pcm.visita_comandos where request_id=p_request_id) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
 v_resultado:=pcm.sso_transferir_os_enviada_conferida(p_request_id,p_intencao_id,p_origem_id,p_destino_id,p_vinculo_id,p_novo_vinculo_id,
  p_revisao_origem,p_revisao_destino,p_sequencia,p_motivo,p_tarefa_esperada);
 select i.cliente_id,i.os_id into v_cliente,v_os from pcm.reprogramacao_os_intencoes i where i.id=p_intencao_id and i.request_id=p_request_id;
 if not found or config.sso_autorizar_acao('material.gerir',v_cliente) is distinct from true then raise exception 'origem_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
 select * into v_lista from pcm.listas_materiais where id=p_lista_id and cliente_id=v_cliente and ordem_servico_id=v_os for share nowait;
 if not found then raise exception 'origem_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.sso_lista_materiais_eventos e where e.lista_id=p_lista_id and e.revisao=p_evento_revisao and e.tipo='excecao' for share nowait;
 if not found or config.sso_autorizar_acao('material.gerir',v_cliente) is distinct from true then raise exception 'origem_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
 v_resultado:=v_resultado||jsonb_build_object('listaId',p_lista_id,'eventoRevisao',p_evento_revisao,'excecaoAtualComprovada',false);
 insert into pcm.sso_intencao_material_origens(request_id,intencao_id,cliente_id,os_id,lista_id,evento_revisao,ator_id,resultado)
  values(p_request_id,p_intencao_id,v_cliente,v_os,p_lista_id,p_evento_revisao,v_actor,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'material.transferencia_os_intencao','ordens_servico',v_os,
  jsonb_build_object('requestId',p_request_id,'intencaoId',p_intencao_id,'listaId',p_lista_id,'eventoRevisao',p_evento_revisao));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_transferir_os_por_material(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text,text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_transferir_os_por_material(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text,text,uuid,integer) to authenticated;
