-- ADR-0381: transição preparada da OS individual; Chamado não é alterado.
create table pcm.sso_finalizar_os_validada_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_finalizar_os_validada_gate enable row level security;
alter table pcm.sso_finalizar_os_validada_gate force row level security;
revoke all on pcm.sso_finalizar_os_validada_gate from public,anon,authenticated,service_role;
insert into pcm.sso_finalizar_os_validada_gate(id,habilitado) values(true,false);
create table pcm.sso_finalizacoes_os_validadas (
 request_id uuid primary key,retorno_id uuid not null references pcm.retorno_os_preparado(id),os_id uuid not null references pcm.ordens_servico(id),
 atestacao_request_id uuid not null references pcm.sso_atestacoes_pcm_retorno(request_id),revisao_decisao integer not null,payload jsonb not null,resultado jsonb not null,
 ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),unique(atestacao_request_id)
);
alter table pcm.sso_finalizacoes_os_validadas enable row level security;
alter table pcm.sso_finalizacoes_os_validadas force row level security;
revoke all on pcm.sso_finalizacoes_os_validadas from public,anon,authenticated,service_role;
create trigger sso_finalizacao_os_imutavel before update or delete on pcm.sso_finalizacoes_os_validadas for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_finalizar_os_validada(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_atestacao_request_id uuid,p_expected_decisao integer,p_expected_status text,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_retorno pcm.retorno_os_preparado%rowtype;v_os pcm.ordens_servico%rowtype;v_atestacao pcm.sso_atestacoes_pcm_retorno%rowtype;v_condicao pcm.sso_condicoes_evidencia_retorno%rowtype;v_ant pcm.sso_finalizacoes_os_validadas%rowtype;
 v_payload jsonb;v_resultado jsonb;v_obrigatorias jsonb;v_evidencias jsonb;v_num integer;v_versionadas integer;v_rev integer;v_estado text;v_evidencias_rev integer;v_decisoes_resposta bigint;v_status_result record;
begin
 if not coalesce((select habilitado from pcm.sso_finalizar_os_validada_gate where id),false) or not coalesce((select habilitado from pcm.sso_atestacao_pcm_gate where id),false) then raise exception 'finalizacao_os_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_retorno_id is null or p_atestacao_request_id is null or p_expected_decisao is null or p_expected_decisao<1 or p_expected_status is null or p_expected_updated_at is null then raise exception 'finalizacao_invalida' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'retornoId',p_retorno_id,'atestacaoRequestId',p_atestacao_request_id,'expectedDecisao',p_expected_decisao,'expectedStatus',p_expected_status,'expectedUpdatedAt',p_expected_updated_at);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_retorno from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id for update;
 if not found or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_os from pcm.ordens_servico where id=v_retorno.os_id and client_id=p_cliente_id and deleted_at is null for update;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_finalizacoes_os_validadas where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return v_ant.resultado; end if;
 if v_os.status is distinct from p_expected_status or v_os.updated_at is distinct from p_expected_updated_at then raise exception 'os_alterada' using errcode='40001'; end if;
 if v_os.status not in ('planejamento','em_execucao') then raise exception 'status_nao_elegivel' using errcode='23514'; end if;
 select * into v_atestacao from pcm.sso_atestacoes_pcm_retorno where request_id=p_atestacao_request_id and retorno_id=p_retorno_id;
 if not found then raise exception 'atestacao_indisponivel' using errcode='23514'; end if;
 select * into v_condicao from pcm.sso_condicoes_evidencia_retorno where id=v_atestacao.condicao_evidencia_id and retorno_id=p_retorno_id;
 if not found then raise exception 'condicao_indisponivel' using errcode='23514'; end if;
 select count(*) into v_num from pcm.decisoes_validacao_os where retorno_id=p_retorno_id;
 select count(*),coalesce(max(revisao),0) into v_versionadas,v_rev from pcm.sso_revisoes_validacao_os where retorno_id=p_retorno_id;
 select d.decisao into v_estado from pcm.sso_revisoes_validacao_os r join pcm.decisoes_validacao_os d on d.id=r.decisao_id where r.retorno_id=p_retorno_id and r.revisao=v_rev and d.id=v_atestacao.decisao_id;
 select coalesce(max(revisao),0) into v_evidencias_rev from pcm.retorno_evidencias_declaradas where retorno_id=p_retorno_id;
 select count(*) into v_decisoes_resposta from pcm.sso_validacoes_resposta where retorno_id=p_retorno_id;
 if v_num<>v_versionadas or v_rev<>p_expected_decisao or v_atestacao.revisao_decisao<>v_rev or v_estado is distinct from 'aprovar' or v_condicao.revisao_decisao<>v_rev-1 or v_condicao.revisao_evidencias<>v_evidencias_rev or v_condicao.decisoes_resposta<>v_decisoes_resposta then raise exception 'atestacao_obsoleta' using errcode='40001'; end if;
 v_obrigatorias:=pcm.sso_checar_obrigatorias_retorno(p_cliente_id,p_retorno_id);v_evidencias:=pcm.sso_checar_evidencias_snapshot(p_cliente_id,p_retorno_id);
 if coalesce((v_obrigatorias->>'perguntas')::integer,0)<1 or coalesce((v_obrigatorias->>'obrigatoriedadeIndeterminada')::integer,1)>0 or coalesce((v_obrigatorias->>'obrigatoriasSemResposta')::integer,1)>0 or coalesce((v_obrigatorias->>'obrigatoriasNaoInspecionadas')::integer,1)>0 or coalesce((v_evidencias->>'requisitoIndeterminado')::integer,1)>0 or coalesce((v_evidencias->>'semDecisaoPcmAceita')::integer,1)>0 then raise exception 'cobertura_pendente' using errcode='23514'; end if;
 if exists(select 1 from pcm.respostas_os_preparadas r where r.retorno_id=p_retorno_id and r.resultado='nao_ok' and not exists(select 1 from pcm.sso_pendencias_tecnicas pe where pe.resposta_id=r.id and pe.retorno_id=p_retorno_id)) then raise exception 'pendencia_nao_ok_ausente' using errcode='23514'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_status_result from pcm.fn_operacao_alterar_status_lote(array[v_os.id],'finalizado');
 if v_status_result.sucesso is distinct from true then raise exception 'transicao_os_recusada' using errcode='23514'; end if;
 v_resultado:=jsonb_build_object('retornoId',p_retorno_id,'osId',v_os.id,'status','finalizado','chamadoAlterado',false,'requestId',p_request_id);
 insert into pcm.sso_finalizacoes_os_validadas(request_id,retorno_id,os_id,atestacao_request_id,revisao_decisao,payload,resultado,ator_id) values(p_request_id,p_retorno_id,v_os.id,p_atestacao_request_id,v_rev,v_payload,v_resultado,v_actor);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'execucao.os_finalizada_validada','ordens_servico',v_os.id,v_resultado);return v_resultado;
end; $$;
revoke all on function pcm.sso_finalizar_os_validada(uuid,uuid,uuid,uuid,integer,text,timestamptz) from public,anon,authenticated,service_role;

create function pcm.sso_previa_finalizacao_os(p_cliente_id uuid,p_retorno_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_os pcm.ordens_servico%rowtype;
begin
 if not coalesce((select habilitado from pcm.sso_finalizar_os_validada_gate where id),false) or not coalesce((select habilitado from pcm.sso_atestacao_pcm_gate where id),false) then raise exception 'finalizacao_os_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select os.* into v_os from pcm.retorno_os_preparado r join pcm.ordens_servico os on os.id=r.os_id and os.client_id=r.cliente_id and os.deleted_at is null where r.id=p_retorno_id and r.cliente_id=p_cliente_id;
 if not found then raise exception 'os_indisponivel' using errcode='23514'; end if;
 return jsonb_build_object('osId',v_os.id,'status',v_os.status,'updatedAt',v_os.updated_at,'chamadoAlterado',false,'notificacaoLegadaPossivel',true);
end; $$;
revoke all on function pcm.sso_previa_finalizacao_os(uuid,uuid) from public,anon,authenticated,service_role;
