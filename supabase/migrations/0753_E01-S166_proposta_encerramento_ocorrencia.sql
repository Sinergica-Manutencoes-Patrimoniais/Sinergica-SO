-- ADR-0528: proposta auditada, nunca encerra ocorrência sem prova transacional integral.
create table pcm.sso_proposta_encerrar_ocorrencia_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_proposta_encerrar_ocorrencia_gate enable row level security;alter table pcm.sso_proposta_encerrar_ocorrencia_gate force row level security;
revoke all on pcm.sso_proposta_encerrar_ocorrencia_gate from public,anon,authenticated,service_role;
insert into pcm.sso_proposta_encerrar_ocorrencia_gate(id,habilitado) values(true,false);
create table pcm.sso_propostas_encerramento_ocorrencia (
 request_id uuid primary key,cliente_id uuid not null,preparada_id uuid not null references pcm.ocorrencias_rotina_preparadas(id),declaracao_request_id uuid not null references pcm.sso_declaracoes_escopo_preventivo(request_id),
 motivo text not null,ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_propostas_encerramento_ocorrencia enable row level security;alter table pcm.sso_propostas_encerramento_ocorrencia force row level security;
revoke all on pcm.sso_propostas_encerramento_ocorrencia from public,anon,authenticated,service_role;
create trigger sso_proposta_encerramento_ocorrencia_imutavel before update or delete on pcm.sso_propostas_encerramento_ocorrencia for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_propor_encerramento_ocorrencia(p_request_id uuid,p_cliente_id uuid,p_preparada_id uuid,p_declaracao_request_id uuid,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_prep pcm.ocorrencias_rotina_preparadas%rowtype;v_decl pcm.sso_declaracoes_escopo_preventivo%rowtype;v_ant pcm.sso_propostas_encerramento_ocorrencia%rowtype;v_ids uuid[];v_total integer;v_nao_validas integer;v_payload jsonb;v_resultado jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if not coalesce((select habilitado from pcm.sso_proposta_encerrar_ocorrencia_gate where id),false) then raise exception 'proposta_encerramento_bloqueada' using errcode='55000';end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_preparada_id is null or p_declaracao_request_id is null or v_motivo is null or length(v_motivo)>2000 then raise exception 'comando_invalido' using errcode='22023';end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'preparadaId',p_preparada_id,'declaracaoRequestId',p_declaracao_request_id,'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('proposta-encerramento:'||p_request_id::text,0));
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_ant from pcm.sso_propostas_encerramento_ocorrencia where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_ant.resultado;end if;
 select o.* into v_prep from pcm.ocorrencias_rotina_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente_id where o.id=p_preparada_id for update of o;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='42501';end if;
 select * into v_decl from pcm.sso_declaracoes_escopo_preventivo where request_id=p_declaracao_request_id and cliente_id=p_cliente_id and ocorrencia_preparada_id=p_preparada_id;
 if not found or (select request_id from pcm.sso_declaracoes_escopo_preventivo where ocorrencia_preparada_id=p_preparada_id order by revisao desc limit 1) is distinct from p_declaracao_request_id then raise exception 'declaracao_obsoleta' using errcode='40001';end if;
 perform os.id from pcm.ordens_servico os where os.ocorrencia_preventiva_id=v_decl.ocorrencia_legada_id and os.client_id=p_cliente_id and os.deleted_at is null order by os.id for share;
 select array_agg(os.id order by os.id),count(*),count(*) filter(where os.status is distinct from 'finalizado' or not exists(select 1 from pcm.sso_finalizacoes_os_validadas f where f.os_id=os.id)) into v_ids,v_total,v_nao_validas from pcm.ordens_servico os where os.ocorrencia_preventiva_id=v_decl.ocorrencia_legada_id and os.client_id=p_cliente_id and os.deleted_at is null;
 if v_total=0 or v_ids is distinct from v_decl.os_ids or v_nao_validas>0 then raise exception 'os_ou_declaracao_incompativeis' using errcode='23514';end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'preparadaId',p_preparada_id,'declaracaoRevisao',v_decl.revisao,'osComparadas',v_total,'escopoIntegralComprovado',false,'aprovacaoAutorizada',false,'ocorrenciaEncerrada',false,'osAlteradas',false);
 insert into pcm.sso_propostas_encerramento_ocorrencia(request_id,cliente_id,preparada_id,declaracao_request_id,motivo,ator_id,payload,resultado) values(p_request_id,p_cliente_id,p_preparada_id,p_declaracao_request_id,v_motivo,v_actor,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'execucao.encerramento_ocorrencia_proposto','planos_manutencao',v_prep.plano_id,v_resultado||jsonb_build_object('motivo',v_motivo));return v_resultado;
end; $$;
revoke all on function pcm.sso_propor_encerramento_ocorrencia(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
