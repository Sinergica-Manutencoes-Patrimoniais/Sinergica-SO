-- ADR-0358: pendências locais preparadas; não modifica status da OS.
create table pcm.sso_pendencias_validacao_retorno (
 request_id uuid primary key,retorno_id uuid not null references pcm.retorno_os_preparado(id),ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_pendencias_validacao_retorno enable row level security;
alter table pcm.sso_pendencias_validacao_retorno force row level security;
revoke all on pcm.sso_pendencias_validacao_retorno from public,anon,authenticated,service_role;
create trigger sso_pendencias_validacao_retorno_imutavel before update or delete on pcm.sso_pendencias_validacao_retorno for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_preparar_pendencias_retorno_aprovado(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_condicao_id uuid,p_expected_decisao integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_retorno pcm.retorno_os_preparado%rowtype;v_ant pcm.sso_pendencias_validacao_retorno%rowtype;v_condicao pcm.sso_condicoes_estruturais_retorno%rowtype;
 v_payload jsonb;v_revision integer;v_versionadas integer;v_decisoes integer;v_evidencias integer;v_estado text;v_resposta record;v_pendencia jsonb;v_qtd integer:=0;v_resultado jsonb;
begin
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_revisao_validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_condicao_retorno_gate where id),false) or not coalesce((select habilitado from pcm.sso_pendencias_gate where id),false) then raise exception 'pendencias_validacao_bloqueadas' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_retorno_id is null or p_condicao_id is null or p_expected_decisao is null or p_expected_decisao<1 then raise exception 'pedido_invalido' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'retornoId',p_retorno_id,'condicaoId',p_condicao_id,'expectedDecisao',p_expected_decisao);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_retorno from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id for update;
 if not found or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_pendencias_validacao_retorno where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return v_ant.resultado; end if;
 select * into v_condicao from pcm.sso_condicoes_estruturais_retorno where id=p_condicao_id and retorno_id=p_retorno_id;
 if not found then raise exception 'condicao_indisponivel' using errcode='23514'; end if;
 select count(*) into v_decisoes from pcm.decisoes_validacao_os where retorno_id=p_retorno_id;
 select count(*),coalesce(max(revisao),0) into v_versionadas,v_revision from pcm.sso_revisoes_validacao_os where retorno_id=p_retorno_id;
 select d.decisao into v_estado from pcm.sso_revisoes_validacao_os r join pcm.decisoes_validacao_os d on d.id=r.decisao_id where r.retorno_id=p_retorno_id and r.revisao=v_revision;
 select coalesce(max(revisao),0) into v_evidencias from pcm.retorno_evidencias_declaradas where retorno_id=p_retorno_id;
 if v_decisoes<>v_versionadas or v_revision<>p_expected_decisao or v_condicao.revisao_decisao<>v_revision-1 or v_condicao.revisao_evidencias<>v_evidencias or v_estado is distinct from 'aprovar' then raise exception 'validacao_ou_condicao_obsoleta' using errcode='40001'; end if;
 for v_resposta in select id from pcm.respostas_os_preparadas where retorno_id=p_retorno_id and resultado='nao_ok' order by id loop
  v_pendencia:=pcm.sso_registrar_pendencia_retorno(gen_random_uuid(),v_resposta.id);v_qtd:=v_qtd+1;
 end loop;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=jsonb_build_object('retornoId',p_retorno_id,'pendenciasProcessadas',v_qtd,'osEncerrada',false,'requestId',p_request_id);
 insert into pcm.sso_pendencias_validacao_retorno(request_id,retorno_id,ator_id,payload,resultado) values(p_request_id,p_retorno_id,v_actor,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'execucao.pendencias_nao_ok_preparadas','retorno_os_preparado',p_retorno_id,v_resultado);return v_resultado;
end; $$;
revoke all on function pcm.sso_preparar_pendencias_retorno_aprovado(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_listar_condicoes_estruturais_retorno(p_cliente_id uuid,p_retorno_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,revisao_evidencias integer,revisao_decisao integer,diagnostico jsonb,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_condicao_retorno_gate where id),false) then raise exception 'condicao_retorno_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select c.id,c.revisao_evidencias,c.revisao_decisao,c.diagnostico,c.criado_em from pcm.sso_condicoes_estruturais_retorno c where c.retorno_id=p_retorno_id and (p_apos is null or c.id>p_apos) order by c.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_condicoes_estruturais_retorno(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
