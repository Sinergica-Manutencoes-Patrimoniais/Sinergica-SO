-- ADR-1377: reconferência explícita, sem OS ou tarefa externa.
create table pcm.sso_confirmar_fila_preventiva_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_confirmar_fila_preventiva_gate(id,habilitado) values(true,false);
alter table pcm.sso_confirmar_fila_preventiva_gate enable row level security;
alter table pcm.sso_confirmar_fila_preventiva_gate force row level security;
revoke all on pcm.sso_confirmar_fila_preventiva_gate from public,anon,authenticated,service_role;

create function pcm.sso_confirmar_fila_preventiva(p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_preparada_id uuid,p_expected_revision integer,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ator uuid:=auth.uid(); v_ciclo uuid; v_fila pcm.sso_fila_preventiva_pcm%rowtype; v_ant pcm.sso_fila_preventiva_pcm_comandos%rowtype;
 v_payload jsonb; v_estado jsonb; v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_fila_preventiva_pcm_gate where id and habilitado for share;
 if not found then raise exception 'fila_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_confirmar_fila_preventiva_gate where id and habilitado for share;
 if not found then raise exception 'confirmacao_desabilitada' using errcode='55000'; end if;
 if v_ator is null or p_request_id is null or p_cliente_id is null or p_plano_id is null or p_preparada_id is null
   or p_expected_revision is null or p_expected_revision<1 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000
   or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'planoId',p_plano_id,'preparadaId',p_preparada_id,'acao','confirmar','expectedRevision',p_expected_revision,'motivo',btrim(p_motivo));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fila-preventiva-request:'||p_request_id::text,0));
 select * into v_ant from pcm.sso_fila_preventiva_pcm_comandos where request_id=p_request_id;
 if found then
   if v_ant.ator_id is distinct from v_ator or v_ant.cliente_id is distinct from p_cliente_id or v_ant.payload is distinct from v_payload then raise exception 'request_conflitante' using errcode='23505'; end if;
   return v_ant.resultado;
 end if;
 lock table pcm.planos_manutencao,pcm.ocorrencias_rotina_preparadas,pcm.ocorrencias_rotina_vinculos,
   pcm.planos_preventivos,pcm.ocorrencias_preventivas,pcm.ordens_servico in share mode nowait;
 select cv.ciclo_id into v_ciclo from pcm.sso_ciclo_calendario_versoes cv
   join pcm.ocorrencias_rotina_preparadas o on o.id=cv.preparada_id
   join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente_id
   where o.id=p_preparada_id and o.plano_id=p_plano_id and cv.versao_id=o.versao_id;
 if v_ciclo is null then raise exception 'identidade_indisponivel' using errcode='23514'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fila-preventiva-ciclo:'||v_ciclo::text,0));
 select * into v_fila from pcm.sso_fila_preventiva_pcm where ciclo_id=v_ciclo for update;
 if not found or v_fila.cliente_id is distinct from p_cliente_id or v_fila.plano_id is distinct from p_plano_id
   or v_fila.preparada_id is distinct from p_preparada_id or v_fila.estado<>'verificacao' or v_fila.revisao<>p_expected_revision then
   raise exception 'fila_ou_revisao_indisponivel' using errcode='40001'; end if;
 v_estado:=pcm.sso_estado_ocorrencia_vinculada(p_cliente_id,p_plano_id,p_preparada_id);
 if v_estado->>'estado' is distinct from 'candidata_aguardando' then raise exception 'elegibilidade_nao_comprovada' using errcode='23514'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 update pcm.sso_fila_preventiva_pcm set estado='aguardando',revisao=revisao+1,atualizado_em=now() where ciclo_id=v_ciclo returning * into v_fila;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'planoId',p_plano_id,'preparadaId',p_preparada_id,
   'cicloId',v_ciclo,'estado',v_fila.estado,'revision',v_fila.revisao,'osCriada',false,'tarefaAuvoCriada',false);
 insert into pcm.sso_fila_preventiva_pcm_comandos(request_id,ator_id,cliente_id,ciclo_id,payload,resultado) values(p_request_id,v_ator,p_cliente_id,v_ciclo,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'preventiva.fila_confirmar','planos_manutencao',p_plano_id,v_resultado||jsonb_build_object('motivo',btrim(p_motivo)));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_confirmar_fila_preventiva(uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_confirmar_fila_preventiva(uuid,uuid,uuid,uuid,integer,text) to authenticated;
