-- ADR-1488: associação explícita ao PMOC, sem criar ou excluir registros operacionais.
create table pcm.sso_vinculo_ciclo_pmoc_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_vinculo_ciclo_pmoc_gate(id,habilitado) values(true,false);
alter table pcm.sso_vinculo_ciclo_pmoc_gate enable row level security;
alter table pcm.sso_vinculo_ciclo_pmoc_gate force row level security;
revoke all on pcm.sso_vinculo_ciclo_pmoc_gate from public,anon,authenticated,service_role;
create table pcm.sso_vinculos_ciclo_pmoc(
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,cliente_id uuid not null,plano_id uuid not null references pcm.planos_manutencao(id),
 versao_id uuid not null references pcm.plano_versoes(id),rotina_id uuid not null,rotina_logica_id uuid not null,alvo_tipo text not null,alvo_id uuid not null,
 vencimento date not null,proposta_id uuid not null unique references pcm.sso_propostas_mapeamento_pmoc(id),decisao_id uuid not null references pcm.sso_decisoes_proposta_pmoc(id),
 agendamento_id uuid not null references pcm.pmoc_schedules(id),contrato_pmoc_id uuid not null references pcm.pmoc_contracts(id),
 evidencia text not null,motivo text not null,ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
create index sso_vinculos_ciclo_pmoc_identidade_idx on pcm.sso_vinculos_ciclo_pmoc(rotina_logica_id,alvo_tipo,alvo_id,vencimento);
alter table pcm.sso_vinculos_ciclo_pmoc enable row level security;
alter table pcm.sso_vinculos_ciclo_pmoc force row level security;
revoke all on pcm.sso_vinculos_ciclo_pmoc from public,anon,authenticated,service_role;
create trigger sso_vinculos_ciclo_pmoc_imutavel before update or delete on pcm.sso_vinculos_ciclo_pmoc for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_vincular_ciclo_pmoc(p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_proposta_id uuid,p_expected_decisao integer,p_confirma_alvo boolean,p_confirma_obrigacao boolean,p_evidencia text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant pcm.sso_vinculos_ciclo_pmoc%rowtype;v_proposta pcm.sso_propostas_mapeamento_pmoc%rowtype;v_decisao pcm.sso_decisoes_proposta_pmoc%rowtype;v_plano pcm.planos_manutencao%rowtype;v_snapshot jsonb;v_rotina jsonb;v_n integer;v_logica uuid;v_contrato uuid;v_payload jsonb;v_resultado jsonb;v_id uuid;v_evidencia text:=nullif(btrim(p_evidencia),'');v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if p_request_id is null or p_proposta_id is null or p_expected_decisao is null or p_expected_decisao<1 or p_confirma_alvo is distinct from true or p_confirma_obrigacao is distinct from true or v_evidencia is null or length(v_evidencia)>500 or v_motivo is null or length(v_motivo)>2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform pcm.sso_conferir_pmoc_mediado(p_ator_id,p_cliente_id,true);
 perform 1 from pcm.sso_vinculo_ciclo_pmoc_gate where id and habilitado for share;
 if not found then raise exception 'vinculo_desabilitado' using errcode='55000'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-vinculo-ciclo-pmoc:'||p_request_id::text,0)) then raise exception 'comando_em_andamento' using errcode='55P03'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'propostaId',p_proposta_id,'expectedDecisao',p_expected_decisao,'confirmaAlvo',p_confirma_alvo,'confirmaObrigacao',p_confirma_obrigacao,'evidencia',v_evidencia,'motivo',v_motivo);
 select * into v_ant from pcm.sso_vinculos_ciclo_pmoc where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from p_ator_id or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return v_ant.resultado; end if;
 select * into v_proposta from pcm.sso_propostas_mapeamento_pmoc where id=p_proposta_id and cliente_id=p_cliente_id for update nowait;
 if not found then raise exception 'proposta_indisponivel' using errcode='42501'; end if;
 select * into v_plano from pcm.planos_manutencao where id=v_proposta.plano_id and cliente_id=p_cliente_id for update nowait;
 if not found or v_plano.revisao<>v_proposta.revisao_plano then raise exception 'plano_alterado' using errcode='40001'; end if;
 select * into v_decisao from pcm.sso_decisoes_proposta_pmoc where proposta_id=p_proposta_id order by revisao desc limit 1;
 if not found or v_decisao.revisao<>p_expected_decisao or v_decisao.decisao<>'validada_pcm' then raise exception 'decisao_nao_validada_ou_obsoleta' using errcode='40001'; end if;
 select snapshot into v_snapshot from pcm.plano_versoes where id=v_proposta.versao_id and plano_id=v_plano.id and estado='aprovado';
 if not found or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514'; end if;
 select count(*),min(item::text)::jsonb into v_n,v_rotina from jsonb_array_elements(v_snapshot->'rotinas') x(item) where item->>'id'=v_proposta.rotina_id::text;
 if v_n<>1 or v_rotina->>'alvo_tipo' is distinct from v_proposta.alvo_tipo or coalesce(v_rotina->>'sistema_id',v_rotina->>'equipamento_id',v_rotina->>'grupo_id') is distinct from v_proposta.alvo_id::text then raise exception 'alvo_incompativel' using errcode='23514'; end if;
 v_logica:=(v_rotina->>'rotina_logica_id')::uuid;
 if v_logica is null then raise exception 'identidade_indisponivel' using errcode='23514'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-identidade-pmoc:'||v_logica::text||':'||v_proposta.alvo_tipo||':'||v_proposta.alvo_id::text||':'||v_proposta.vencimento::text,0)) then raise exception 'identidade_em_alteracao' using errcode='55P03'; end if;
 -- Abrange inserções concorrentes; NOWAIT evita bloquear outros processos.
 lock table pcm.pmoc_schedules,pcm.pmoc_properties,pcm.pmoc_contracts,pcm.ocorrencias_rotina_preparadas,pcm.ocorrencias_visita_preparadas,pcm.rotina_origem_geracao in share mode nowait;
 select s.contract_id into v_contrato from pcm.pmoc_schedules s join pcm.pmoc_properties p on p.id=s.property_id and p.client_id=p_cliente_id and p.deleted_at is null join pcm.pmoc_contracts c on c.id=s.contract_id and c.property_id=p.id and c.deleted_at is null where s.id=v_proposta.agendamento_pmoc_id and s.scheduled_date=v_proposta.vencimento and s.status<>'cancelado';
 if not found then raise exception 'agendamento_ou_data_indisponivel' using errcode='23514'; end if;
 if exists(select 1 from pcm.sso_vinculos_ciclo_pmoc v join pcm.pmoc_schedules s on s.id=v.agendamento_id and s.contract_id=v.contrato_pmoc_id and s.scheduled_date=v.vencimento and s.status<>'cancelado'
  join pcm.sso_decisoes_proposta_pmoc d on d.id=v.decisao_id and d.decisao='validada_pcm' and d.revisao=(select max(x.revisao) from pcm.sso_decisoes_proposta_pmoc x where x.proposta_id=v.proposta_id)
  where v.rotina_logica_id=v_logica and v.alvo_tipo=v_proposta.alvo_tipo and v.alvo_id=v_proposta.alvo_id and v.vencimento=v_proposta.vencimento) then raise exception 'ciclo_pmoc_ja_vinculado' using errcode='23505'; end if;
 if not exists(select 1 from pcm.rotina_origem_geracao g where g.rotina_logica_id=v_logica and g.alvo_tipo=v_proposta.alvo_tipo and g.alvo_id=v_proposta.alvo_id and g.origem='pmoc') then raise exception 'origem_pmoc_nao_declarada' using errcode='23514'; end if;
 if exists(select 1 from pcm.ocorrencias_rotina_preparadas o where o.rotina_logica_id=v_logica and o.alvo_tipo=v_proposta.alvo_tipo and o.alvo_id=v_proposta.alvo_id and o.vencimento_original=v_proposta.vencimento) or exists(select 1 from pcm.ocorrencias_visita_preparadas o where o.rotina_logica_id=v_logica and o.alvo_tipo=v_proposta.alvo_tipo and o.alvo_id=v_proposta.alvo_id and o.vencimento_original=v_proposta.vencimento) then raise exception 'ocorrencia_plano_exige_reconciliacao' using errcode='23514'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_id:=gen_random_uuid();v_resultado:=jsonb_build_object('requestId',p_request_id,'vinculoId',v_id,'propostaId',p_proposta_id,'agendamentoId',v_proposta.agendamento_pmoc_id,'escopoDeclaradoPcm',true,'fonteIndependenteValidada',false,'exclusividadeGlobalComprovada',false,'ocorrenciaCriada',false,'osCriada',false,'tarefaAuvoCriada',false);
 insert into pcm.sso_vinculos_ciclo_pmoc(id,request_id,cliente_id,plano_id,versao_id,rotina_id,rotina_logica_id,alvo_tipo,alvo_id,vencimento,proposta_id,decisao_id,agendamento_id,contrato_pmoc_id,evidencia,motivo,ator_id,payload,resultado) values(v_id,p_request_id,p_cliente_id,v_plano.id,v_proposta.versao_id,v_proposta.rotina_id,v_logica,v_proposta.alvo_tipo,v_proposta.alvo_id,v_proposta.vencimento,p_proposta_id,v_decisao.id,v_proposta.agendamento_pmoc_id,v_contrato,v_evidencia,v_motivo,p_ator_id,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'calendario.ciclo_pmoc_vinculado','planos_manutencao',v_plano.id,v_resultado||jsonb_build_object('evidencia',v_evidencia,'motivo',v_motivo));return v_resultado;
end; $$;
revoke all on function pcm.sso_vincular_ciclo_pmoc(uuid,uuid,uuid,uuid,integer,boolean,boolean,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_vincular_ciclo_pmoc(uuid,uuid,uuid,uuid,integer,boolean,boolean,text,text) to authenticated;

create function pcm.sso_consultar_vinculo_ciclo_pmoc(p_ator_id uuid,p_cliente_id uuid,p_proposta_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_vinculo pcm.sso_vinculos_ciclo_pmoc%rowtype;v_valido boolean;
begin
 perform pcm.sso_conferir_pmoc_mediado(p_ator_id,p_cliente_id,true);
 perform 1 from pcm.sso_vinculo_ciclo_pmoc_gate where id and habilitado for share;
 if not found then raise exception 'vinculo_desabilitado' using errcode='55000'; end if;
 if not exists(select 1 from pcm.sso_propostas_mapeamento_pmoc where id=p_proposta_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_vinculo from pcm.sso_vinculos_ciclo_pmoc where proposta_id=p_proposta_id and cliente_id=p_cliente_id;
 if not found then return jsonb_build_object('propostaId',p_proposta_id,'vinculoId',null,'estado','nao_vinculado','agendamentoId',null); end if;
 select exists(select 1 from pcm.pmoc_schedules s join pcm.pmoc_properties p on p.id=s.property_id and p.client_id=p_cliente_id and p.deleted_at is null join pcm.pmoc_contracts c on c.id=s.contract_id and c.property_id=p.id and c.deleted_at is null where s.id=v_vinculo.agendamento_id and s.contract_id=v_vinculo.contrato_pmoc_id and s.scheduled_date=v_vinculo.vencimento and s.status<>'cancelado')
  and exists(select 1 from pcm.sso_decisoes_proposta_pmoc d where d.id=v_vinculo.decisao_id and d.decisao='validada_pcm' and d.revisao=(select max(x.revisao) from pcm.sso_decisoes_proposta_pmoc x where x.proposta_id=p_proposta_id)) into v_valido;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return jsonb_build_object('propostaId',p_proposta_id,'vinculoId',v_vinculo.id,'estado',case when v_valido then 'declarado_pcm' else 'revisao_necessaria' end,'agendamentoId',v_vinculo.agendamento_id);
end; $$;
revoke all on function pcm.sso_consultar_vinculo_ciclo_pmoc(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_vinculo_ciclo_pmoc(uuid,uuid,uuid) to authenticated;
