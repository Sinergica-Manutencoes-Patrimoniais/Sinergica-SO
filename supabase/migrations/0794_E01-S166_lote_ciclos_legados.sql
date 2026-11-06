-- ADR-0569: lote atômico usando o comando individual 0764.
create table pcm.sso_lote_ciclos_legados_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_lote_ciclos_legados_gate enable row level security;alter table pcm.sso_lote_ciclos_legados_gate force row level security;
revoke all on pcm.sso_lote_ciclos_legados_gate from public,anon,authenticated,service_role;
insert into pcm.sso_lote_ciclos_legados_gate(id,habilitado) values(true,false);

create function pcm.sso_materializar_lote_legado(p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_plano_legado_id uuid,p_relacao_request_id uuid,p_expected_revision integer,p_preparadas uuid[],p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_plano pcm.planos_manutencao%rowtype;v_ant pcm.calendario_contratual_comandos%rowtype;v_ids uuid[];v_id uuid;v_unico jsonb;v_itens jsonb:='[]'::jsonb;v_criadas integer:=0;v_payload jsonb;v_resultado jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if not coalesce((select habilitado from pcm.sso_lote_ciclos_legados_gate where id),false) then raise exception 'lote_legado_bloqueado' using errcode='55000';end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_plano_id is null or p_plano_legado_id is null or p_relacao_request_id is null or p_expected_revision is null or p_expected_revision<1 or p_preparadas is null or cardinality(p_preparadas) not between 1 and 25 or array_position(p_preparadas,null) is not null or v_motivo is null or length(v_motivo)>2000 then raise exception 'lote_invalido' using errcode='22023';end if;
 select array_agg(id order by id) into v_ids from (select distinct unnest(p_preparadas) id) s;
 if cardinality(v_ids)<>cardinality(p_preparadas) then raise exception 'ciclos_duplicados' using errcode='22023';end if;
 v_payload:=jsonb_build_object('tipo','materializarLoteLegado','clienteId',p_cliente_id,'planoId',p_plano_id,'planoLegadoId',p_plano_legado_id,'relacaoRequestId',p_relacao_request_id,'expectedRevision',p_expected_revision,'preparadas',to_jsonb(v_ids),'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendario-request:'||p_request_id::text,0));
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_ant from pcm.calendario_contratual_comandos where request_id=p_request_id;
 if found then if v_ant.actor_id is distinct from v_actor or v_ant.cliente_id is distinct from p_cliente_id or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_ant.resultado;end if;
 select * into v_plano from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for update;
 if not found then raise exception 'plano_indisponivel' using errcode='42501';end if;
 if v_plano.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 if (select count(*) from pcm.ocorrencias_rotina_preparadas where id=any(v_ids) and plano_id=p_plano_id)<>cardinality(v_ids) then raise exception 'ciclo_outro_plano_ou_indisponivel' using errcode='23514';end if;
 foreach v_id in array v_ids loop
  v_unico:=pcm.sso_materializar_ciclo_legado(gen_random_uuid(),p_cliente_id,v_id,p_plano_legado_id,p_relacao_request_id,gen_random_uuid(),v_motivo);
  if v_unico->>'preparadaId' is distinct from v_id::text or v_unico->'osCriada' is distinct from 'false'::jsonb or v_unico->'tarefaAuvoCriada' is distinct from 'false'::jsonb then raise exception 'resultado_incompativel' using errcode='23514';end if;
  if coalesce((v_unico->>'ocorrenciaLegadaCriada')::boolean,false) then v_criadas:=v_criadas+1;end if;
  v_itens:=v_itens||jsonb_build_array(jsonb_build_object('preparadaId',v_id,'legadaId',v_unico->'legadaId','cicloId',v_unico->'cicloId','criada',v_unico->'ocorrenciaLegadaCriada'));
 end loop;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'total',cardinality(v_ids),'criadas',v_criadas,'itens',v_itens,'atomico',true,'osCriada',false,'tarefaAuvoCriada',false,'equivalenciaGeralComprovada',false);
 insert into pcm.calendario_contratual_comandos(request_id,actor_id,cliente_id,payload,resultado) values(p_request_id,v_actor,p_cliente_id,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'calendario.lote_legado_integrado','planos_manutencao',p_plano_id,v_resultado||jsonb_build_object('motivo',v_motivo));return v_resultado;
end; $$;
revoke all on function pcm.sso_materializar_lote_legado(uuid,uuid,uuid,uuid,uuid,integer,uuid[],text) from public,anon,authenticated,service_role;
