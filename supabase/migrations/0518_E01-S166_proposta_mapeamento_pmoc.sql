-- ADR-0292: proposta não validada, sem alteração de PMOC ou deduplicação.
create table pcm.sso_propostas_mapeamento_pmoc (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,cliente_id uuid not null references pcm.clientes(id),
 plano_id uuid not null references pcm.planos_manutencao(id),versao_id uuid not null references pcm.plano_versoes(id),rotina_id uuid not null,
 vencimento date not null,agendamento_pmoc_id uuid not null references pcm.pmoc_schedules(id),alvo_tipo text not null,alvo_id uuid not null,
 revisao_plano integer not null,justificativa text not null check(length(btrim(justificativa)) between 1 and 2000),
 payload jsonb not null,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now()
);
alter table pcm.sso_propostas_mapeamento_pmoc enable row level security;
alter table pcm.sso_propostas_mapeamento_pmoc force row level security;
revoke all on pcm.sso_propostas_mapeamento_pmoc from public,anon,authenticated,service_role;
create trigger sso_proposta_mapeamento_pmoc_imutavel before update or delete on pcm.sso_propostas_mapeamento_pmoc for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_propor_mapeamento_pmoc(p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_revision integer,p_versao_id uuid,p_rotina_id uuid,p_vencimento date,p_agendamento_id uuid,p_justificativa text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_plano pcm.planos_manutencao%rowtype;v_anterior pcm.sso_propostas_mapeamento_pmoc%rowtype;v_snapshot jsonb;v_rotina jsonb;v_num integer;v_alvo_tipo text;v_alvo_id uuid;v_precondicoes jsonb;v_payload jsonb;v_id uuid;
begin
 if not coalesce((select habilitado from pcm.sso_diagnostico_pmoc_gate where id),false) then raise exception 'diagnostico_pmoc_bloqueado' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_plano_id is null or p_expected_revision is null or p_expected_revision<1 or p_versao_id is null or p_rotina_id is null or p_vencimento is null or not isfinite(p_vencimento) or p_agendamento_id is null or p_justificativa is null or length(btrim(p_justificativa)) not between 1 and 2000 then raise exception 'proposta_invalida' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'planoId',p_plano_id,'expectedRevision',p_expected_revision,'versaoId',p_versao_id,'rotinaId',p_rotina_id,'vencimento',p_vencimento,'agendamentoId',p_agendamento_id,'justificativa',btrim(p_justificativa));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_plano from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for update;
 if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_anterior from pcm.sso_propostas_mapeamento_pmoc where request_id=p_request_id;
 if found then if v_anterior.ator_id is distinct from v_actor or v_anterior.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return jsonb_build_object('propostaId',v_anterior.id,'state','pendente','requestId',p_request_id); end if;
 if v_plano.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 v_precondicoes:=pcm.sso_verificar_vinculo_ciclo_pmoc(p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,p_vencimento,p_agendamento_id);
 if (v_precondicoes->>'cicloPrevisto')::boolean is distinct from true then raise exception 'ciclo_indisponivel' using errcode='23514'; end if;
 select snapshot into v_snapshot from pcm.plano_versoes where id=p_versao_id and plano_id=p_plano_id and estado='aprovado';
 if not found or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514'; end if;
 select count(*),min(x.item::text)::jsonb into v_num,v_rotina from jsonb_array_elements(v_snapshot->'rotinas') x(item) where x.item->>'id'=p_rotina_id::text;
 if v_num<>1 then raise exception 'rotina_indisponivel' using errcode='23514'; end if;
 v_alvo_tipo:=v_rotina->'alvo'->>'tipo';v_alvo_id:=(v_rotina->'alvo'->>'id')::uuid;
 if v_alvo_tipo is null or v_alvo_tipo not in ('sistema','componente','grupo') or v_alvo_id is null then raise exception 'alvo_indisponivel' using errcode='23514'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 insert into pcm.sso_propostas_mapeamento_pmoc(request_id,cliente_id,plano_id,versao_id,rotina_id,vencimento,agendamento_pmoc_id,alvo_tipo,alvo_id,revisao_plano,justificativa,payload,ator_id)
 values(p_request_id,p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,p_vencimento,p_agendamento_id,v_alvo_tipo,v_alvo_id,v_plano.revisao,btrim(p_justificativa),v_payload,v_actor) returning id into v_id;
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'pmoc.mapeamento_proposto','sso_propostas_mapeamento_pmoc',v_id,jsonb_build_object('requestId',p_request_id,'planoId',p_plano_id,'versaoId',p_versao_id,'rotinaId',p_rotina_id));
 return jsonb_build_object('propostaId',v_id,'state','pendente','requestId',p_request_id);
end; $$;
revoke all on function pcm.sso_propor_mapeamento_pmoc(uuid,uuid,uuid,integer,uuid,uuid,date,uuid,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_agendamentos_pmoc_candidatos(p_cliente_id uuid,p_data date,p_apos uuid,p_limite integer)
returns table(id uuid,scheduled_date date,maintenance_type text,status text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_diagnostico_pmoc_gate where id),false) then raise exception 'diagnostico_pmoc_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_data is null or not isfinite(p_data) or p_limite is null or p_limite not between 1 and 100 then raise exception 'consulta_invalida' using errcode='22023'; end if;
 return query select s.id,s.scheduled_date,s.maintenance_type,s.status from pcm.pmoc_schedules s join pcm.pmoc_properties p on p.id=s.property_id and p.client_id=p_cliente_id and p.deleted_at is null join pcm.pmoc_contracts k on k.id=s.contract_id and k.property_id=p.id and k.deleted_at is null where s.status<>'cancelado' and s.scheduled_date=p_data and (p_apos is null or s.id>p_apos) order by s.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_agendamentos_pmoc_candidatos(uuid,date,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_listar_propostas_mapeamento_pmoc(p_cliente_id uuid,p_plano_id uuid,p_rotina_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,versao_id uuid,vencimento date,agendamento_pmoc_id uuid,alvo_tipo text,alvo_id uuid,revisao_plano integer,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_diagnostico_pmoc_gate where id),false) then raise exception 'diagnostico_pmoc_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select p.id,p.versao_id,p.vencimento,p.agendamento_pmoc_id,p.alvo_tipo,p.alvo_id,p.revisao_plano,p.justificativa,p.ator_id,p.criado_em from pcm.sso_propostas_mapeamento_pmoc p where p.cliente_id=p_cliente_id and p.plano_id=p_plano_id and p.rotina_id=p_rotina_id and (p_apos is null or p.id>p_apos) order by p.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_propostas_mapeamento_pmoc(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
