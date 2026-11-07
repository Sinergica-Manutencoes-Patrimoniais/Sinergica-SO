-- ADR-0498: ponte exclusiva para ocorrência legada existente, não cria Plano fictício.
create table pcm.sso_vinculo_visita_legado_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_vinculo_visita_legado_gate enable row level security;
alter table pcm.sso_vinculo_visita_legado_gate force row level security;
revoke all on pcm.sso_vinculo_visita_legado_gate from public,anon,authenticated,service_role;
insert into pcm.sso_vinculo_visita_legado_gate(id,habilitado) values(true,false);
create table pcm.sso_vinculos_visita_legado (
 request_id uuid primary key,cliente_id uuid not null,ocorrencia_visita_id uuid not null unique references pcm.ocorrencias_visita_preparadas(id),ocorrencia_legada_id uuid not null unique references pcm.ocorrencias_preventivas(id),
 relacao_request_id uuid not null references pcm.sso_declaracoes_planos_legados(request_id),motivo text not null,ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_vinculos_visita_legado enable row level security;
alter table pcm.sso_vinculos_visita_legado force row level security;
revoke all on pcm.sso_vinculos_visita_legado from public,anon,authenticated,service_role;
create trigger sso_vinculo_visita_legado_imutavel before update or delete on pcm.sso_vinculos_visita_legado for each row execute function pcm.sso_proteger_conferencia_levantamento();

-- Todos os novos vínculos de calendário também devem observar a ponte de Visita.
create function pcm.sso_guardar_exclusividade_ocorrencia_legada() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.ocorrencia_legada_id is null then return new;end if;
 perform 1 from pcm.ocorrencias_preventivas where id=new.ocorrencia_legada_id for update;
 if exists(select 1 from pcm.sso_vinculos_visita_legado where ocorrencia_legada_id=new.ocorrencia_legada_id) then raise exception 'ocorrencia_legada_ja_vinculada_visita' using errcode='23505';end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_exclusividade_ocorrencia_legada() from public,anon,authenticated,service_role;
create trigger sso_exclusividade_ocorrencia_calendario before insert on pcm.ocorrencias_rotina_vinculos for each row execute function pcm.sso_guardar_exclusividade_ocorrencia_legada();

create function pcm.sso_vincular_visita_legado_existente(p_request_id uuid,p_cliente_id uuid,p_visita_ocorrencia_id uuid,p_legada_id uuid,p_relacao_request_id uuid,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_prep pcm.ocorrencias_visita_preparadas%rowtype;v_plano pcm.planos_manutencao%rowtype;v_leg pcm.ocorrencias_preventivas%rowtype;v_legacy pcm.planos_preventivos%rowtype;v_versao pcm.plano_versoes%rowtype;v_rotina jsonb;v_n integer;v_rel pcm.sso_declaracoes_planos_legados%rowtype;v_ant pcm.sso_vinculos_visita_legado%rowtype;v_payload jsonb;v_resultado jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if not coalesce((select habilitado from pcm.sso_vinculo_visita_legado_gate where id),false) or not coalesce((select habilitado from pcm.ocorrencia_rotina_gate where id),false) then raise exception 'vinculo_visita_bloqueado' using errcode='55000';end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_visita_ocorrencia_id is null or p_legada_id is null or p_relacao_request_id is null or v_motivo is null or length(v_motivo)>2000 then raise exception 'comando_invalido' using errcode='22023';end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'ocorrenciaVisitaId',p_visita_ocorrencia_id,'legadaId',p_legada_id,'relacaoRequestId',p_relacao_request_id,'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('vinculo-visita-legado:'||p_request_id::text,0));
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_ant from pcm.sso_vinculos_visita_legado where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_ant.resultado;end if;
 select o.* into v_prep from pcm.ocorrencias_visita_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente_id where o.id=p_visita_ocorrencia_id for update of o;
 if not found then raise exception 'ocorrencia_visita_indisponivel' using errcode='42501';end if;
 select * into v_plano from pcm.planos_manutencao where id=v_prep.plano_id and cliente_id=p_cliente_id for update;
 if not found or v_plano.estado not in ('aprovado','ativo') then raise exception 'plano_inativo' using errcode='23514';end if;
 select * into v_leg from pcm.ocorrencias_preventivas where id=p_legada_id for update;
 if not found then raise exception 'legada_indisponivel' using errcode='23514';end if;
 select * into v_legacy from pcm.planos_preventivos where id=v_leg.plano_id and cliente_id=p_cliente_id for share;
 if not found then raise exception 'legada_indisponivel' using errcode='42501';end if;
 select * into v_rel from pcm.sso_declaracoes_planos_legados where request_id=p_relacao_request_id and cliente_id=p_cliente_id and plano_id=v_plano.id and plano_legado_id=v_legacy.id and decisao='declarar';
 if not found or (select request_id from pcm.sso_declaracoes_planos_legados where plano_id=v_plano.id and plano_legado_id=v_legacy.id order by revisao desc limit 1) is distinct from p_relacao_request_id then raise exception 'relacao_nao_atual' using errcode='23514';end if;
 if v_leg.origem is distinct from 'legado' or v_leg.vencimento is distinct from v_prep.vencimento_original or v_leg.envio_estado is distinct from 'prevista' or v_leg.auvo_task_id is not null or v_leg.resultado_estado is distinct from 'pendente' or exists(select 1 from pcm.ordens_servico os where os.ocorrencia_preventiva_id=v_leg.id) or exists(select 1 from pcm.ocorrencias_rotina_vinculos where ocorrencia_legada_id=v_leg.id) then raise exception 'legada_exige_reconciliacao' using errcode='23514';end if;
 if not ((v_prep.alvo_tipo='sistema' and v_legacy.sistema_id=v_prep.alvo_id) or (v_prep.alvo_tipo='componente' and v_legacy.equipamento_id=v_prep.alvo_id)) then raise exception 'alvo_nao_comprovado' using errcode='23514';end if;
 select * into v_versao from pcm.plano_versoes where id=v_prep.versao_id and plano_id=v_plano.id and estado='aprovado';
 if not found or jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514';end if;
 select count(*),min(item::text)::jsonb into v_n,v_rotina from jsonb_array_elements(v_versao.snapshot->'rotinas') x(item) where item->>'id'=v_prep.rotina_id::text;
 if v_n<>1 or v_rotina->>'modo' is distinct from 'visita' or v_rotina->>'questionario_id' is distinct from v_legacy.questionario_id::text then raise exception 'rotina_ou_questionario_incompativel' using errcode='23514';end if;
 if not exists(select 1 from pcm.visita_origem_contratual o join pcm.visitas v on v.id=o.visita_id and v.cliente_id=o.cliente_id where o.visita_id=v_prep.visita_id and o.cliente_id=p_cliente_id and o.serie_id=v_prep.serie_id and o.semana_origem=v_prep.semana_origem and v.estado not in ('cancelada','concluida')) then raise exception 'visita_incompativel' using errcode='23514';end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'ocorrenciaVisitaId',p_visita_ocorrencia_id,'legadaId',p_legada_id,'vinculoCriado',true,'planoLegadoCriado',false,'ocorrenciaLegadaCriada',false,'osCriada',false,'tarefaAuvoCriada',false,'equivalenciaGeralComprovada',false);
 insert into pcm.sso_vinculos_visita_legado(request_id,cliente_id,ocorrencia_visita_id,ocorrencia_legada_id,relacao_request_id,motivo,ator_id,payload,resultado) values(p_request_id,p_cliente_id,p_visita_ocorrencia_id,p_legada_id,p_relacao_request_id,v_motivo,v_actor,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'calendario.visita_legado_vinculada','planos_manutencao',v_plano.id,v_resultado||jsonb_build_object('motivo',v_motivo));return v_resultado;
end; $$;
revoke all on function pcm.sso_vincular_visita_legado_existente(uuid,uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
