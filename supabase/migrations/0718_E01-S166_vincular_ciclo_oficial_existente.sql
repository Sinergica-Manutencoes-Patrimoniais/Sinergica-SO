-- ADR-0492: integra somente ocorrência legada existente com decisão humana; não cria legado ou OS.
create table pcm.sso_integrar_ciclo_existente_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_integrar_ciclo_existente_gate enable row level security;
alter table pcm.sso_integrar_ciclo_existente_gate force row level security;
revoke all on pcm.sso_integrar_ciclo_existente_gate from public,anon,authenticated,service_role;
insert into pcm.sso_integrar_ciclo_existente_gate(id,habilitado) values(true,false);
create table pcm.sso_integracoes_ciclo_existente (
 request_id uuid primary key,cliente_id uuid not null,ocorrencia_preparada_id uuid not null references pcm.ocorrencias_rotina_preparadas(id),ocorrencia_legada_id uuid not null references pcm.ocorrencias_preventivas(id),
 ciclo_id uuid not null,relacao_request_id uuid not null references pcm.sso_declaracoes_planos_legados(request_id),motivo text not null,ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now(),unique(ocorrencia_preparada_id),unique(ocorrencia_legada_id)
);
alter table pcm.sso_integracoes_ciclo_existente enable row level security;
alter table pcm.sso_integracoes_ciclo_existente force row level security;
revoke all on pcm.sso_integracoes_ciclo_existente from public,anon,authenticated,service_role;
create trigger sso_integracao_ciclo_imutavel before update or delete on pcm.sso_integracoes_ciclo_existente for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_integrar_ciclo_legado_existente(p_request_id uuid,p_cliente_id uuid,p_preparada_id uuid,p_legada_id uuid,p_ciclo_id uuid,p_relacao_request_id uuid,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_prep pcm.ocorrencias_rotina_preparadas%rowtype;v_leg pcm.ocorrencias_preventivas%rowtype;v_legacy pcm.planos_preventivos%rowtype;v_rel pcm.sso_declaracoes_planos_legados%rowtype;v_ant pcm.sso_integracoes_ciclo_existente%rowtype;v_payload jsonb;v_resultado jsonb;v_vinculo jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if not coalesce((select habilitado from pcm.sso_integrar_ciclo_existente_gate where id),false) or not coalesce((select habilitado from pcm.ocorrencia_rotina_gate where id),false) or not coalesce((select habilitado from pcm.sso_vinculo_visita_legado_gate where id),false) then raise exception 'integracao_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_preparada_id is null or p_legada_id is null or p_ciclo_id is null or p_relacao_request_id is null or v_motivo is null or length(v_motivo)>2000 then raise exception 'integracao_invalida' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'preparadaId',p_preparada_id,'legadaId',p_legada_id,'cicloId',p_ciclo_id,'relacaoRequestId',p_relacao_request_id,'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('integrar-ciclo:'||p_request_id::text,0));
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_integracoes_ciclo_existente where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return v_ant.resultado;end if;
 select o.* into v_prep from pcm.ocorrencias_rotina_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente_id where o.id=p_preparada_id for update of o;
 if not found then raise exception 'preparada_indisponivel' using errcode='42501'; end if;
 perform 1 from pcm.planos_manutencao where id=v_prep.plano_id and cliente_id=p_cliente_id for update;
 if not found then raise exception 'plano_indisponivel' using errcode='42501'; end if;
 select * into v_leg from pcm.ocorrencias_preventivas where id=p_legada_id for update;
 if not found then raise exception 'legada_indisponivel' using errcode='23514'; end if;
 select * into v_legacy from pcm.planos_preventivos where id=v_leg.plano_id and cliente_id=p_cliente_id for share;
 if not found then raise exception 'legada_indisponivel' using errcode='42501'; end if;
 select * into v_rel from pcm.sso_declaracoes_planos_legados where request_id=p_relacao_request_id and cliente_id=p_cliente_id and plano_id=v_prep.plano_id and plano_legado_id=v_legacy.id and decisao='declarar';
 if not found or (select d.request_id from pcm.sso_declaracoes_planos_legados d where d.plano_id=v_prep.plano_id and d.plano_legado_id=v_legacy.id order by d.revisao desc limit 1) is distinct from p_relacao_request_id then raise exception 'relacao_nao_atual' using errcode='23514'; end if;
 if v_leg.origem is distinct from 'legado' or v_leg.vencimento is distinct from v_prep.vencimento_original or v_leg.envio_estado is distinct from 'prevista' or v_leg.auvo_task_id is not null or v_leg.resultado_estado is distinct from 'pendente' or exists(select 1 from pcm.ordens_servico os where os.ocorrencia_preventiva_id=v_leg.id) then raise exception 'legada_exige_reconciliacao' using errcode='23514'; end if;
 if not ((v_prep.alvo_tipo='sistema' and v_legacy.sistema_id=v_prep.alvo_id) or (v_prep.alvo_tipo='componente' and v_legacy.equipamento_id=v_prep.alvo_id)) then raise exception 'alvo_nao_comprovado' using errcode='23514'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_vinculo:=pcm.sso_vincular_ocorrencia_preparada(gen_random_uuid(),p_preparada_id,p_ciclo_id,p_legada_id);
 v_resultado:=jsonb_build_object('requestId',p_request_id,'preparadaId',p_preparada_id,'legadaId',p_legada_id,'cicloId',p_ciclo_id,'vinculoCriado',true,'ocorrenciaLegadaCriada',false,'osCriada',false,'tarefaAuvoCriada',false,'equivalenciaGeralComprovada',false);
 insert into pcm.sso_integracoes_ciclo_existente(request_id,cliente_id,ocorrencia_preparada_id,ocorrencia_legada_id,ciclo_id,relacao_request_id,motivo,ator_id,payload,resultado) values(p_request_id,p_cliente_id,p_preparada_id,p_legada_id,p_ciclo_id,p_relacao_request_id,v_motivo,v_actor,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'calendario.ciclo_legado_integrado','planos_manutencao',v_prep.plano_id,v_resultado||jsonb_build_object('motivo',v_motivo));return v_resultado;
end; $$;
revoke all on function pcm.sso_integrar_ciclo_legado_existente(uuid,uuid,uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
