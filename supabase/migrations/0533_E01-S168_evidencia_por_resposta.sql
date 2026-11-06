-- ADR-0307: relação humana, não autentica anexos nem comprova execução.
create table pcm.sso_evidencia_resposta_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_evidencia_resposta_gate enable row level security;
alter table pcm.sso_evidencia_resposta_gate force row level security;
revoke all on pcm.sso_evidencia_resposta_gate from public,anon,authenticated,service_role;
insert into pcm.sso_evidencia_resposta_gate(id,habilitado) values(true,false);
create table pcm.sso_evidencias_por_resposta (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,retorno_id uuid not null references pcm.retorno_os_preparado(id),
 resposta_id uuid not null references pcm.respostas_os_preparadas(id),evidencia_id uuid not null references pcm.retorno_evidencias_declaradas(id),
 revisao_evidencias integer not null,motivo text not null check(length(btrim(motivo)) between 1 and 2000),payload jsonb not null,
 ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),unique(retorno_id,resposta_id,evidencia_id)
);
alter table pcm.sso_evidencias_por_resposta enable row level security;
alter table pcm.sso_evidencias_por_resposta force row level security;
revoke all on pcm.sso_evidencias_por_resposta from public,anon,authenticated,service_role;
create trigger sso_evidencia_por_resposta_imutavel before update or delete on pcm.sso_evidencias_por_resposta for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_vincular_evidencia_resposta(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_resposta_id uuid,p_evidencia_id uuid,p_expected_evidencias integer,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_retorno pcm.retorno_os_preparado%rowtype;v_anterior pcm.sso_evidencias_por_resposta%rowtype;v_payload jsonb;v_revisao integer;v_id uuid;
begin
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.origem_campo_inbox_gate where id),false) or not coalesce((select habilitado from pcm.sso_evidencia_resposta_gate where id),false) then raise exception 'evidencia_resposta_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_retorno_id is null or p_resposta_id is null or p_evidencia_id is null or p_expected_evidencias is null or p_expected_evidencias<1 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'vinculo_invalido' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'retornoId',p_retorno_id,'respostaId',p_resposta_id,'evidenciaId',p_evidencia_id,'expectedEvidencias',p_expected_evidencias,'motivo',btrim(p_motivo));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_retorno from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id and origem='manual_declarado' for update;
 if not found or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_anterior from pcm.sso_evidencias_por_resposta where request_id=p_request_id;
 if found then if v_anterior.ator_id is distinct from v_actor or v_anterior.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return jsonb_build_object('vinculoId',v_anterior.id,'requestId',p_request_id,'evidenciaAutenticada',false); end if;
 select coalesce(max(revisao),0) into v_revisao from pcm.retorno_evidencias_declaradas where retorno_id=p_retorno_id;
 if v_revisao<>p_expected_evidencias then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if not exists(select 1 from pcm.respostas_os_preparadas where id=p_resposta_id and retorno_id=p_retorno_id) or not exists(select 1 from pcm.retorno_evidencias_declaradas where id=p_evidencia_id and retorno_id=p_retorno_id) then raise exception 'referencia_indisponivel' using errcode='23514'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 insert into pcm.sso_evidencias_por_resposta(request_id,retorno_id,resposta_id,evidencia_id,revisao_evidencias,motivo,payload,ator_id) values(p_request_id,p_retorno_id,p_resposta_id,p_evidencia_id,v_revisao,btrim(p_motivo),v_payload,v_actor) returning id into v_id;
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'execucao.evidencia_resposta_declarada','retorno_os_preparado',p_retorno_id,jsonb_build_object('requestId',p_request_id,'vinculoId',v_id,'respostaId',p_resposta_id,'evidenciaId',p_evidencia_id));
 return jsonb_build_object('vinculoId',v_id,'requestId',p_request_id,'evidenciaAutenticada',false);
end; $$;
revoke all on function pcm.sso_vincular_evidencia_resposta(uuid,uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_respostas_retorno(p_cliente_id uuid,p_retorno_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,chave_pergunta text,resultado text,observacao text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.origem_campo_inbox_gate where id),false) or not coalesce((select habilitado from pcm.sso_evidencia_resposta_gate where id),false) then raise exception 'evidencia_resposta_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select r.id,r.chave_pergunta,r.resultado,r.observacao from pcm.respostas_os_preparadas r where r.retorno_id=p_retorno_id and (p_apos is null or r.id>p_apos) order by r.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_respostas_retorno(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_listar_evidencias_por_resposta(p_cliente_id uuid,p_retorno_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,resposta_id uuid,evidencia_id uuid,revisao_evidencias integer,motivo text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.origem_campo_inbox_gate where id),false) or not coalesce((select habilitado from pcm.sso_evidencia_resposta_gate where id),false) then raise exception 'evidencia_resposta_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select v.id,v.resposta_id,v.evidencia_id,v.revisao_evidencias,v.motivo,v.ator_id,v.criado_em from pcm.sso_evidencias_por_resposta v where v.retorno_id=p_retorno_id and (p_apos is null or v.id>p_apos) order by v.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_evidencias_por_resposta(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
