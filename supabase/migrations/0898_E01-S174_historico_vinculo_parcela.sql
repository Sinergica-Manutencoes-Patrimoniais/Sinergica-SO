-- ADR-0673: histórico declarado aditivo; sem alterar vínculo ativo ou fila.
create table pcm.sso_historico_vinculo_parcela_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_historico_vinculo_parcela_gate enable row level security;alter table pcm.sso_historico_vinculo_parcela_gate force row level security;
revoke all on pcm.sso_historico_vinculo_parcela_gate from public,anon,authenticated,service_role;
insert into pcm.sso_historico_vinculo_parcela_gate(id,habilitado) values(true,false);
create table pcm.sso_eventos_vinculo_parcela (
 request_id uuid primary key,cliente_id uuid not null references pcm.clientes(id),pendencia_id uuid not null references pcm.sso_pendencias_tecnicas(id),
 parcela_id uuid not null references pcm.chamado_escopo_parcelas(id),composicao_id uuid not null references pcm.sso_backlog_composicoes(id),chamado_id uuid not null references pcm.chamados(id),
 vinculo_request_id uuid not null references pcm.sso_backlog_parcelas(request_id),revisao integer not null check(revisao>0),
 evento text not null check(evento in ('origem_declarada','encerramento_declarado','reentrada_declarada')),
 motivo text not null check(length(btrim(motivo)) between 1 and 2000),ator_id uuid not null references auth.users(id),payload jsonb not null,criado_em timestamptz not null default now(),unique(pendencia_id,revisao)
);
alter table pcm.sso_eventos_vinculo_parcela enable row level security;alter table pcm.sso_eventos_vinculo_parcela force row level security;
revoke all on pcm.sso_eventos_vinculo_parcela from public,anon,authenticated,service_role;
create trigger sso_eventos_vinculo_parcela_imutavel before update or delete on pcm.sso_eventos_vinculo_parcela for each row execute function pcm.sso_proteger_conferencia_levantamento();
create function pcm.sso_declarar_evento_vinculo_parcela(p_request_id uuid,p_cliente_id uuid,p_pendencia_id uuid,p_expected_revision integer,p_evento text,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_vinculo pcm.sso_backlog_parcelas%rowtype;v_ant pcm.sso_eventos_vinculo_parcela%rowtype;v_ultimo pcm.sso_eventos_vinculo_parcela%rowtype;v_payload jsonb;v_motivo text:=nullif(btrim(p_motivo),'');v_rev integer;
begin
 if not coalesce((select habilitado from pcm.sso_historico_vinculo_parcela_gate where id),false) then raise exception 'historico_vinculo_bloqueado' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_pendencia_id is null or p_expected_revision is null or p_expected_revision<0 or p_evento is null or p_evento not in ('origem_declarada','encerramento_declarado','reentrada_declarada') or v_motivo is null or length(v_motivo)>2000 then raise exception 'pedido_invalido' using errcode='22023'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'pendenciaId',p_pendencia_id,'expectedRevision',p_expected_revision,'evento',p_evento,'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('historico-vinculo-parcela:'||p_request_id::text,0));
 select * into v_ant from pcm.sso_eventos_vinculo_parcela where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return jsonb_build_object('requestId',p_request_id,'revisao',v_ant.revisao,'evento',v_ant.evento,'vinculoAlterado',false,'devolucaoAutorizada',false); end if;
 select * into v_vinculo from pcm.sso_backlog_parcelas where pendencia_id=p_pendencia_id and cliente_id=p_cliente_id;
 if not found then raise exception 'vinculo_indisponivel' using errcode='42501'; end if;
 perform 1 from pcm.chamados where id=v_vinculo.chamado_id and cliente_id=p_cliente_id and deleted_at is null for update;
 if not found then raise exception 'chamado_indisponivel' using errcode='23514'; end if;
 perform 1 from pcm.sso_backlog_composicoes where id=v_vinculo.composicao_id and cliente_id=p_cliente_id for update;
 if not found then raise exception 'composicao_indisponivel' using errcode='23514'; end if;
 perform 1 from pcm.chamado_escopo_parcelas where id=v_vinculo.parcela_id and chamado_id=v_vinculo.chamado_id for update;
 if not found then raise exception 'parcela_indisponivel' using errcode='23514'; end if;
 perform 1 from pcm.sso_pendencias_tecnicas where id=p_pendencia_id and cliente_id=p_cliente_id for update;
 if not found or not exists(select 1 from pcm.sso_backlog_parcelas v where v.request_id=v_vinculo.request_id and v.pendencia_id=p_pendencia_id and v.cliente_id=p_cliente_id and v.parcela_id=v_vinculo.parcela_id and v.chamado_id=v_vinculo.chamado_id and v.composicao_id=v_vinculo.composicao_id) then raise exception 'vinculo_alterado' using errcode='40001'; end if;
 select * into v_ultimo from pcm.sso_eventos_vinculo_parcela where pendencia_id=p_pendencia_id order by revisao desc limit 1;
 v_rev:=coalesce(v_ultimo.revisao,0);
 if v_rev<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if (v_rev=0 and p_evento<>'origem_declarada') or (v_rev>0 and (v_ultimo.vinculo_request_id is distinct from v_vinculo.request_id or not ((v_ultimo.evento in ('origem_declarada','reentrada_declarada') and p_evento='encerramento_declarado') or (v_ultimo.evento='encerramento_declarado' and p_evento='reentrada_declarada')))) then raise exception 'transicao_invalida' using errcode='23514'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 insert into pcm.sso_eventos_vinculo_parcela(request_id,cliente_id,pendencia_id,parcela_id,composicao_id,chamado_id,vinculo_request_id,revisao,evento,motivo,ator_id,payload) values(p_request_id,p_cliente_id,p_pendencia_id,v_vinculo.parcela_id,v_vinculo.composicao_id,v_vinculo.chamado_id,v_vinculo.request_id,v_rev+1,p_evento,v_motivo,v_actor,v_payload);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'backlog.historico_vinculo_declarado','sso_backlog_composicoes',v_vinculo.composicao_id,v_payload||jsonb_build_object('revisao',v_rev+1,'vinculoRequestId',v_vinculo.request_id));
 return jsonb_build_object('requestId',p_request_id,'revisao',v_rev+1,'evento',p_evento,'vinculoAlterado',false,'devolucaoAutorizada',false);
end; $$;
revoke all on function pcm.sso_declarar_evento_vinculo_parcela(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
create function pcm.sso_listar_eventos_vinculo_parcela(p_cliente_id uuid,p_pendencia_id uuid,p_antes integer,p_limite integer)
returns table(request_id uuid,revisao integer,evento text,parcela_id uuid,composicao_id uuid,chamado_id uuid,motivo text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_historico_vinculo_parcela_gate where id),false) then raise exception 'historico_vinculo_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_pendencia_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.sso_pendencias_tecnicas where id=p_pendencia_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 or (p_antes is not null and p_antes<1) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select e.request_id,e.revisao,e.evento,e.parcela_id,e.composicao_id,e.chamado_id,e.motivo,e.ator_id,e.criado_em from pcm.sso_eventos_vinculo_parcela e where e.cliente_id=p_cliente_id and e.pendencia_id=p_pendencia_id and (p_antes is null or e.revisao<p_antes) order by e.revisao desc limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_eventos_vinculo_parcela(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
