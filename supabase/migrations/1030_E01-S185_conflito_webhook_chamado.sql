-- ADR-0842: captura mínima privada; gate fechado, sem efeito externo.
create table pcm.sso_conflito_webhook_chamado_gate (
 id boolean primary key default true check(id), habilitado boolean not null default false
);
alter table pcm.sso_conflito_webhook_chamado_gate enable row level security;
alter table pcm.sso_conflito_webhook_chamado_gate force row level security;
revoke all on pcm.sso_conflito_webhook_chamado_gate from public,anon,authenticated,service_role;
insert into pcm.sso_conflito_webhook_chamado_gate(id,habilitado) values(true,false);

create table pcm.reconciliacao_webhook_chamado_conflitos (
 id uuid primary key default gen_random_uuid(),
 cliente_id uuid not null references pcm.clientes(id),
 os_id uuid not null references pcm.ordens_servico(id),
 auvo_task_id bigint not null check(auvo_task_id>0),
 status_remoto text not null check(status_remoto in ('solicitacao','corretiva','backlog','planejamento','em_execucao','cancelado')),
 criado_em timestamptz not null default now(),
 resolvido_em timestamptz
);
create unique index reconciliacao_webhook_chamado_ativo on pcm.reconciliacao_webhook_chamado_conflitos(os_id,auvo_task_id,status_remoto) where resolvido_em is null;
alter table pcm.reconciliacao_webhook_chamado_conflitos enable row level security;
alter table pcm.reconciliacao_webhook_chamado_conflitos force row level security;
revoke all on pcm.reconciliacao_webhook_chamado_conflitos from public,anon,authenticated,service_role;

create function pcm.sso_registrar_conflito_webhook_chamado(p_os_id uuid,p_auvo_task_id bigint,p_status_remoto text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_cliente_id uuid; v_id uuid;
begin
 if not coalesce((select habilitado from pcm.sso_conflito_webhook_chamado_gate where id),false) then raise exception 'captura_conflito_bloqueada' using errcode='55000'; end if;
 if p_os_id is null or p_auvo_task_id is null or p_auvo_task_id<1 or p_status_remoto is null
   or p_status_remoto not in ('solicitacao','corretiva','backlog','planejamento','em_execucao','cancelado') then raise exception 'conflito_invalido' using errcode='22023'; end if;
 select o.client_id into v_cliente_id from pcm.ordens_servico o where o.id=p_os_id and o.auvo_task_id=p_auvo_task_id and o.deleted_at is null for share;
 if not found or not exists(select 1 from pcm.chamados c where c.cliente_id=v_cliente_id and c.sso_encerrado_em is not null and (c.ordem_servico_id=p_os_id or c.id=(select o.chamado_id from pcm.ordens_servico o where o.id=p_os_id))) then
   raise exception 'conflito_nao_confirmado' using errcode='23514'; end if;
 insert into pcm.reconciliacao_webhook_chamado_conflitos(cliente_id,os_id,auvo_task_id,status_remoto)
 values(v_cliente_id,p_os_id,p_auvo_task_id,p_status_remoto)
 on conflict (os_id,auvo_task_id,status_remoto) where resolvido_em is null do nothing returning id into v_id;
 if v_id is not null then
   insert into audit.events(actor_id,action,entity,entity_id,payload) values(null,'integracao.conflito_webhook_chamado','ordens_servico',p_os_id,
     jsonb_build_object('conflitoId',v_id,'clienteId',v_cliente_id,'statusRemoto',p_status_remoto));
 else
   select id into v_id from pcm.reconciliacao_webhook_chamado_conflitos where os_id=p_os_id and auvo_task_id=p_auvo_task_id and status_remoto=p_status_remoto and resolvido_em is null;
 end if;
 if v_id is null then raise exception 'conflito_concorrente' using errcode='40001'; end if;
 return v_id;
end; $$;
revoke all on function pcm.sso_registrar_conflito_webhook_chamado(uuid,bigint,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_registrar_conflito_webhook_chamado(uuid,bigint,text) to service_role;

create or replace function pcm.sso_listar_os_reconciliacao(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,numero text,status_operacional text,status_sync text,auvo_task_id text,
 atualizado_em timestamptz,classificacao text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select g.habilitado from pcm.reconciliacao_outbox_gate g where g.id),false) then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select o.id,o.numero::text,o.status::text,o.auvo_sync_status::text,o.auvo_task_id::text,coalesce(o.updated_at,o.created_at),
   case when exists(select 1 from pcm.reconciliacao_webhook_chamado_conflitos x where x.os_id=o.id and x.cliente_id=p_cliente_id and x.resolvido_em is null) then 'conflito_chamado_encerrado'
     when o.auvo_task_id is not null then 'vinculo_observado_nao_confirmado' else 'incerto' end::text
 from pcm.ordens_servico o where o.client_id=p_cliente_id and o.deleted_at is null
   and (o.auvo_sync_status is not null or o.auvo_task_id is not null)
   and (p_apos is null or o.id>p_apos) order by o.id limit p_limite;
end; $$;
