-- ADR-0634: quantidade declarada, não prova execução nem cobertura integral.
create table pcm.sso_quantidade_declarada_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_quantidade_declarada_grupo_gate enable row level security;
alter table pcm.sso_quantidade_declarada_grupo_gate force row level security;
revoke all on pcm.sso_quantidade_declarada_grupo_gate from public,anon,authenticated,service_role;
insert into pcm.sso_quantidade_declarada_grupo_gate(id,habilitado) values(true,false);
create table pcm.sso_quantidades_declaradas_grupo (
 request_id uuid primary key,cliente_id uuid not null references pcm.clientes(id),ocorrencia_id uuid not null references pcm.sso_ocorrencias_grupo(id),
 os_id uuid not null references pcm.ordens_servico(id),atestado_request_id uuid not null references pcm.sso_atestados_declarados_grupo(request_id),
 revisao integer not null check(revisao>0),quantidade_declarada bigint not null check(quantidade_declarada>=0),quantidade_snapshot bigint not null,
 motivo text not null,ator_id uuid not null references auth.users(id),payload jsonb not null,criado_em timestamptz not null default now(),unique(ocorrencia_id,revisao),
 check(quantidade_declarada<=quantidade_snapshot)
);
alter table pcm.sso_quantidades_declaradas_grupo enable row level security;
alter table pcm.sso_quantidades_declaradas_grupo force row level security;
revoke all on pcm.sso_quantidades_declaradas_grupo from public,anon,authenticated,service_role;
create trigger sso_quantidade_grupo_imutavel before update or delete on pcm.sso_quantidades_declaradas_grupo for each row execute function pcm.sso_proteger_conferencia_levantamento();
create function pcm.sso_declarar_quantidade_grupo(p_request_id uuid,p_cliente_id uuid,p_ocorrencia_id uuid,p_atestado_id uuid,p_expected_revision integer,p_quantidade text,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_ant pcm.sso_quantidades_declaradas_grupo%rowtype;v_ocorrencia pcm.sso_ocorrencias_grupo%rowtype;v_atestado pcm.sso_atestados_declarados_grupo%rowtype;v_rev integer;v_qtd bigint;v_payload jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if not coalesce((select habilitado from pcm.sso_quantidade_declarada_grupo_gate where id),false) then raise exception 'quantidade_grupo_bloqueada' using errcode='55000'; end if;
 if v_ator is null or p_request_id is null or p_cliente_id is null or p_ocorrencia_id is null or p_atestado_id is null or p_expected_revision is null or p_expected_revision<0 or p_quantidade is null or p_quantidade !~ '^(0|[1-9][0-9]{0,15})$' or v_motivo is null or length(v_motivo)>2000 then raise exception 'pedido_invalido' using errcode='22023'; end if;
 v_qtd:=p_quantidade::bigint;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'ocorrenciaId',p_ocorrencia_id,'atestadoId',p_atestado_id,'expectedRevision',p_expected_revision,'quantidade',p_quantidade,'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('quantidade-grupo:'||p_request_id::text,0));
 select * into v_ant from pcm.sso_quantidades_declaradas_grupo where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_ator or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return jsonb_build_object('requestId',p_request_id,'revisao',v_ant.revisao,'quantidade',v_ant.quantidade_declarada::text,'execucaoComprovada',false,'ocorrenciaEncerrada',false); end if;
 select * into v_ocorrencia from pcm.sso_ocorrencias_grupo where id=p_ocorrencia_id and cliente_id=p_cliente_id for update;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='42501'; end if;
 select * into v_atestado from pcm.sso_atestados_declarados_grupo where request_id=p_atestado_id and ocorrencia_id=p_ocorrencia_id and cliente_id=p_cliente_id;
 if not found or v_atestado.quantidade_snapshot is distinct from v_ocorrencia.quantidade_snapshot or not exists(select 1 from pcm.sso_vinculos_os_grupo v join pcm.ordens_servico os on os.id=v.os_id and os.client_id=v.cliente_id and os.deleted_at is null where v.ocorrencia_grupo_id=p_ocorrencia_id and v.cliente_id=p_cliente_id and v.os_id=v_atestado.os_id) then raise exception 'atestado_ou_vinculo_indisponivel' using errcode='23514'; end if;
 if v_qtd>v_ocorrencia.quantidade_snapshot then raise exception 'quantidade_excede_snapshot' using errcode='23514'; end if;
 select coalesce(max(revisao),0) into v_rev from pcm.sso_quantidades_declaradas_grupo where ocorrencia_id=p_ocorrencia_id;
 if v_rev<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 insert into pcm.sso_quantidades_declaradas_grupo(request_id,cliente_id,ocorrencia_id,os_id,atestado_request_id,revisao,quantidade_declarada,quantidade_snapshot,motivo,ator_id,payload) values(p_request_id,p_cliente_id,p_ocorrencia_id,v_atestado.os_id,p_atestado_id,v_rev+1,v_qtd,v_ocorrencia.quantidade_snapshot,v_motivo,v_ator,v_payload);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'execucao.quantidade_grupo_declarada','ordens_servico',v_atestado.os_id,jsonb_build_object('requestId',p_request_id,'ocorrenciaId',p_ocorrencia_id,'revisao',v_rev+1,'quantidade',p_quantidade));
 return jsonb_build_object('requestId',p_request_id,'revisao',v_rev+1,'quantidade',p_quantidade,'execucaoComprovada',false,'ocorrenciaEncerrada',false);
end; $$;
revoke all on function pcm.sso_declarar_quantidade_grupo(uuid,uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
create function pcm.sso_listar_quantidades_grupo(p_cliente_id uuid,p_ocorrencia_id uuid,p_antes integer,p_limite integer)
returns table(request_id uuid,os_id uuid,atestado_request_id uuid,revisao integer,quantidade_declarada text,quantidade_snapshot text,motivo text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_quantidade_declarada_grupo_gate where id),false) then raise exception 'quantidade_grupo_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.sso_ocorrencias_grupo where id=p_ocorrencia_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 or (p_antes is not null and p_antes<1) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select q.request_id,q.os_id,q.atestado_request_id,q.revisao,q.quantidade_declarada::text,q.quantidade_snapshot::text,q.motivo,q.ator_id,q.criado_em from pcm.sso_quantidades_declaradas_grupo q where q.cliente_id=p_cliente_id and q.ocorrencia_id=p_ocorrencia_id and (p_antes is null or q.revisao<p_antes) order by q.revisao desc limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_quantidades_grupo(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
