-- ADR-0565: lote atômico limitado a janela civil, sem OS nem Auvo.
create table pcm.sso_lote_ciclos_calendario_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_lote_ciclos_calendario_gate enable row level security;alter table pcm.sso_lote_ciclos_calendario_gate force row level security;
revoke all on pcm.sso_lote_ciclos_calendario_gate from public,anon,authenticated,service_role;
insert into pcm.sso_lote_ciclos_calendario_gate(id,habilitado) values(true,false);

create function pcm.sso_materializar_lote_calendario(p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_expected_revision integer,p_inicio date,p_fim date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_plano pcm.planos_manutencao%rowtype;v_ant pcm.calendario_contratual_comandos%rowtype;v_hoje date;v_linha record;v_unico jsonb;v_lista jsonb:='[]'::jsonb;v_n integer:=0;v_criadas integer:=0;v_payload jsonb;v_resultado jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_lote_ciclos_calendario_gate where id),false) then raise exception 'lote_calendario_bloqueado' using errcode='55000';end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_plano_id is null or p_versao_id is null or p_rotina_id is null or p_expected_revision is null or p_expected_revision<1 or p_inicio is null or p_fim is null or not isfinite(p_inicio) or not isfinite(p_fim) or p_fim<p_inicio then raise exception 'janela_invalida' using errcode='22023';end if;
 v_payload:=jsonb_build_object('tipo','materializarLoteCalendario','clienteId',p_cliente_id,'planoId',p_plano_id,'versaoId',p_versao_id,'rotinaId',p_rotina_id,'expectedRevision',p_expected_revision,'inicio',p_inicio,'fim',p_fim);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendario-request:'||p_request_id::text,0));
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_ant from pcm.calendario_contratual_comandos where request_id=p_request_id;
 if found then if v_ant.actor_id is distinct from v_actor or v_ant.cliente_id is distinct from p_cliente_id or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_ant.resultado;end if;
 select * into v_plano from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for update;
 if not found or not pcm.sso_plano_permite_gerar_versao(p_plano_id,p_versao_id) then raise exception 'plano_indisponivel' using errcode='23514';end if;
 if v_plano.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 v_hoje:=pcm.sso_data_civil_versao_geracao(p_plano_id,p_versao_id);
 if p_inicio<v_hoje or p_fim>v_hoje+30 then raise exception 'janela_fora_do_limite' using errcode='22023';end if;
 for v_linha in select * from pcm.sso_prever_ciclos_rotina(p_plano_id,p_versao_id,p_rotina_id,p_inicio,p_fim) order by ciclo loop
  v_n:=v_n+1;if v_n>31 then raise exception 'lote_excede_limite' using errcode='23514';end if;
  v_unico:=pcm.sso_materializar_ciclo_canonico(gen_random_uuid(),p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,p_expected_revision,v_linha.vencimento);
  if (v_unico->>'indice')::integer is distinct from v_linha.ciclo or (v_unico->>'vencimentoOriginal')::date is distinct from v_linha.vencimento then raise exception 'ciclo_resultado_incompativel' using errcode='23514';end if;
  if coalesce((v_unico->>'criada')::boolean,false) then v_criadas:=v_criadas+1;end if;
  v_lista:=v_lista||jsonb_build_array(jsonb_build_object('indice',v_linha.ciclo,'vencimentoOriginal',v_linha.vencimento,'preparadaId',v_unico->'preparadaId','cicloCanonicoId',v_unico->'cicloCanonicoId','criada',v_unico->'criada'));
 end loop;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'dataReferenciaCivil',v_hoje,'inicio',p_inicio,'fim',p_fim,'total',v_n,'criadas',v_criadas,'itens',v_lista,'atomico',true,'osCriada',false,'tarefaAuvoCriada',false);
 insert into pcm.calendario_contratual_comandos(request_id,actor_id,cliente_id,payload,resultado) values(p_request_id,v_actor,p_cliente_id,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'calendario.lote_canonico_preparado','planos_manutencao',p_plano_id,v_resultado);return v_resultado;
end; $$;
revoke all on function pcm.sso_materializar_lote_calendario(uuid,uuid,uuid,uuid,uuid,integer,date,date) from public,anon,authenticated,service_role;
