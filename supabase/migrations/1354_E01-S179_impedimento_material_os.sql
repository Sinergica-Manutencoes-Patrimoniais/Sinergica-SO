-- ADR-1200: intenção local auditada, não altera tarefa externa.
create table pcm.sso_impedimento_material_os_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_impedimento_material_os_gate(id,habilitado) values(true,false);
create table pcm.sso_impedimento_material_os_eventos(
 os_id uuid not null references pcm.ordens_servico(id),revisao integer not null check(revisao>0),
 cliente_id uuid not null references pcm.clientes(id),lista_id uuid not null references pcm.listas_materiais(id),
 evento_revision integer not null,estado text not null check(estado in ('suspenso','retomado')),
 motivo text not null check(length(btrim(motivo)) between 1 and 2000),ator_id uuid not null references auth.users(id),
 request_id uuid not null unique,payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now(),
 primary key(os_id,revisao),foreign key(lista_id,evento_revision) references pcm.sso_lista_materiais_eventos(lista_id,revisao)
);
alter table pcm.sso_impedimento_material_os_gate enable row level security;
alter table pcm.sso_impedimento_material_os_gate force row level security;
alter table pcm.sso_impedimento_material_os_eventos enable row level security;
alter table pcm.sso_impedimento_material_os_eventos force row level security;
revoke all on pcm.sso_impedimento_material_os_gate,pcm.sso_impedimento_material_os_eventos from public,anon,authenticated,service_role;
create trigger sso_impedimento_material_os_imutavel before update or delete on pcm.sso_impedimento_material_os_eventos
 for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function pcm.sso_declarar_impedimento_material_os(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_os_id uuid,
 p_lista_id uuid,p_evento_revision integer,p_expected_revision integer,p_estado text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_anterior pcm.sso_impedimento_material_os_eventos%rowtype;v_ultimo pcm.sso_impedimento_material_os_eventos%rowtype;
 v_revisao integer;v_payload jsonb;v_resultado jsonb;
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null or p_os_id is null or p_lista_id is null
  or p_evento_revision is null or p_evento_revision<2 or p_expected_revision is null or p_expected_revision<0
  or p_estado is null or p_estado not in ('suspenso','retomado') or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_impedimento_material_os_gate g where g.id and g.habilitado for share;
 if not found then raise exception 'impedimento_desabilitado' using errcode='55000'; end if;
 if config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'osId',p_os_id,'listaId',p_lista_id,'eventoRevision',p_evento_revision,'expectedRevision',p_expected_revision,'estado',p_estado,'motivo',btrim(p_motivo));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('impedimento-material-request:'||p_request_id::text,0));
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('impedimento-material-os:'||p_os_id::text,0)) then raise exception 'os_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.listas_materiais l where l.id=p_lista_id and l.cliente_id=p_cliente_id and l.ordem_servico_id=p_os_id for share;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.ordens_servico o where o.id=p_os_id and o.client_id=p_cliente_id and o.deleted_at is null for update;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_anterior from pcm.sso_impedimento_material_os_eventos e where e.request_id=p_request_id;
 if found then
  if v_anterior.ator_id is distinct from p_ator_id or v_anterior.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  return v_anterior.resultado;
 end if;
 if not exists(select 1 from pcm.ordens_servico o where o.id=p_os_id and o.status in ('solicitacao','corretiva','backlog','planejamento','em_execucao'))
  or not exists(select 1 from pcm.sso_lista_materiais_eventos e where e.lista_id=p_lista_id and e.revisao=p_evento_revision and e.tipo='excecao') then raise exception 'origem_invalida' using errcode='23514'; end if;
 select * into v_ultimo from pcm.sso_impedimento_material_os_eventos e where e.os_id=p_os_id order by e.revisao desc limit 1;
 v_revisao:=coalesce(v_ultimo.revisao,0);
 if v_revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if (p_estado='suspenso' and v_ultimo.estado='suspenso') or (p_estado='retomado' and (v_ultimo.estado is distinct from 'suspenso' or v_ultimo.lista_id is distinct from p_lista_id or v_ultimo.evento_revision is distinct from p_evento_revision)) then raise exception 'transicao_invalida' using errcode='23514'; end if;
 if config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'osId',p_os_id,'listaId',p_lista_id,'eventoRevision',p_evento_revision,'revision',v_revisao+1,'estado',p_estado,'efeitoRemoto',false,'osAlterada',false);
 insert into pcm.sso_impedimento_material_os_eventos(os_id,revisao,cliente_id,lista_id,evento_revision,estado,motivo,ator_id,request_id,payload,resultado)
 values(p_os_id,v_revisao+1,p_cliente_id,p_lista_id,p_evento_revision,p_estado,btrim(p_motivo),p_ator_id,p_request_id,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'material.impedimento_os_declarado','ordens_servico',p_os_id,v_resultado);
 return v_resultado;
end; $$;
revoke all on function pcm.sso_declarar_impedimento_material_os(uuid,uuid,uuid,uuid,uuid,integer,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_declarar_impedimento_material_os(uuid,uuid,uuid,uuid,uuid,integer,integer,text,text) to authenticated;

create function pcm.sso_listar_impedimentos_material_os(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_antes integer,p_limite integer)
returns table(revisao integer,lista_id uuid,evento_revision integer,estado text,motivo text,ator_id uuid,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_os_id is null or p_limite is null or p_limite not between 1 and 50
  or (p_antes is not null and p_antes<1) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_impedimento_material_os_gate g where g.id and g.habilitado for share;
 if not found then raise exception 'impedimento_desabilitado' using errcode='55000'; end if;
 if config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.ordens_servico o where o.id=p_os_id and o.client_id=p_cliente_id and o.deleted_at is null for share;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select e.revisao,e.lista_id,e.evento_revision,e.estado,e.motivo,e.ator_id,e.criado_em
  from pcm.sso_impedimento_material_os_eventos e where e.os_id=p_os_id and e.cliente_id=p_cliente_id
  and (p_antes is null or e.revisao<p_antes) order by e.revisao desc limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_impedimentos_material_os(uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_impedimentos_material_os(uuid,uuid,uuid,integer,integer) to authenticated;
