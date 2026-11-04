-- ADR-0296: decisão humana auditada, sem deduplicação automática.
create table pcm.sso_decisao_pmoc_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_decisao_pmoc_gate enable row level security;
alter table pcm.sso_decisao_pmoc_gate force row level security;
revoke all on pcm.sso_decisao_pmoc_gate from public,anon,authenticated,service_role;
insert into pcm.sso_decisao_pmoc_gate(id,habilitado) values(true,false);
create table pcm.sso_decisoes_proposta_pmoc (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,proposta_id uuid not null references pcm.sso_propostas_mapeamento_pmoc(id),
 revisao integer not null check(revisao>0),decisao text not null check(decisao in ('validada_pcm','rejeitada')),
 evidencia_referencia text not null check(length(btrim(evidencia_referencia)) between 1 and 500),
 justificativa text not null check(length(btrim(justificativa)) between 1 and 2000),payload jsonb not null,
 ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),unique(proposta_id,revisao)
);
alter table pcm.sso_decisoes_proposta_pmoc enable row level security;
alter table pcm.sso_decisoes_proposta_pmoc force row level security;
revoke all on pcm.sso_decisoes_proposta_pmoc from public,anon,authenticated,service_role;
create trigger sso_decisao_proposta_pmoc_imutavel before update or delete on pcm.sso_decisoes_proposta_pmoc for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_decidir_proposta_pmoc(p_request_id uuid,p_cliente_id uuid,p_proposta_id uuid,p_expected_revision integer,p_decisao text,p_evidencia_referencia text,p_justificativa text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_proposta pcm.sso_propostas_mapeamento_pmoc%rowtype;v_plano pcm.planos_manutencao%rowtype;v_existente pcm.sso_decisoes_proposta_pmoc%rowtype;v_revisao integer;v_id uuid;v_payload jsonb;v_precondicoes jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_diagnostico_pmoc_gate where id),false) or not coalesce((select habilitado from pcm.sso_decisao_pmoc_gate where id),false) then raise exception 'decisao_pmoc_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_proposta_id is null or p_expected_revision is null or p_expected_revision<0 or p_decisao is null or p_decisao not in ('validada_pcm','rejeitada') or p_evidencia_referencia is null or length(btrim(p_evidencia_referencia)) not between 1 and 500 or p_justificativa is null or length(btrim(p_justificativa)) not between 1 and 2000 then raise exception 'decisao_invalida' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'propostaId',p_proposta_id,'expectedRevision',p_expected_revision,'decisao',p_decisao,'evidencia',btrim(p_evidencia_referencia),'justificativa',btrim(p_justificativa));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_proposta from pcm.sso_propostas_mapeamento_pmoc where id=p_proposta_id and cliente_id=p_cliente_id for update;
 if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_existente from pcm.sso_decisoes_proposta_pmoc where request_id=p_request_id;
 if found then if v_existente.ator_id is distinct from v_actor or v_existente.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return jsonb_build_object('decisaoId',v_existente.id,'revision',v_existente.revisao,'state',v_existente.decisao,'requestId',p_request_id); end if;
 select * into v_plano from pcm.planos_manutencao where id=v_proposta.plano_id and cliente_id=p_cliente_id for share;
 if not found or v_plano.revisao<>v_proposta.revisao_plano then raise exception 'plano_alterado' using errcode='40001'; end if;
 select coalesce(max(revisao),0) into v_revisao from pcm.sso_decisoes_proposta_pmoc where proposta_id=p_proposta_id;
 if v_revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 v_precondicoes:=pcm.sso_verificar_vinculo_ciclo_pmoc(p_cliente_id,v_proposta.plano_id,v_proposta.versao_id,v_proposta.rotina_id,v_proposta.vencimento,v_proposta.agendamento_pmoc_id);
 if (v_precondicoes->>'cicloPrevisto')::boolean is distinct from true then raise exception 'ciclo_indisponivel' using errcode='23514'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 insert into pcm.sso_decisoes_proposta_pmoc(request_id,proposta_id,revisao,decisao,evidencia_referencia,justificativa,payload,ator_id)
 values(p_request_id,p_proposta_id,v_revisao+1,p_decisao,btrim(p_evidencia_referencia),btrim(p_justificativa),v_payload,v_actor) returning id into v_id;
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'pmoc.proposta_decidida','sso_propostas_mapeamento_pmoc',p_proposta_id,jsonb_build_object('requestId',p_request_id,'decisaoId',v_id,'revision',v_revisao+1,'decisao',p_decisao));
 return jsonb_build_object('decisaoId',v_id,'revision',v_revisao+1,'state',p_decisao,'requestId',p_request_id,'deduplicacaoAtiva',false);
end; $$;
revoke all on function pcm.sso_decidir_proposta_pmoc(uuid,uuid,uuid,integer,text,text,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_decisoes_proposta_pmoc(p_cliente_id uuid,p_proposta_id uuid,p_antes integer,p_limite integer)
returns table(id uuid,revisao integer,decisao text,evidencia_referencia text,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_diagnostico_pmoc_gate where id),false) or not coalesce((select habilitado from pcm.sso_decisao_pmoc_gate where id),false) then raise exception 'decisao_pmoc_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.sso_propostas_mapeamento_pmoc where id=p_proposta_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 or (p_antes is not null and p_antes<1) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select d.id,d.revisao,d.decisao,d.evidencia_referencia,d.justificativa,d.ator_id,d.criado_em from pcm.sso_decisoes_proposta_pmoc d where d.proposta_id=p_proposta_id and (p_antes is null or d.revisao<p_antes) order by d.revisao desc limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_decisoes_proposta_pmoc(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
