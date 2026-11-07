-- ADR-0437: triagem local administrativa, sem reenvio.
create table pcm.reconciliacao_funcionario_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.reconciliacao_funcionario_gate(id,habilitado) values(true,false);
alter table pcm.reconciliacao_funcionario_gate enable row level security;
alter table pcm.reconciliacao_funcionario_gate force row level security;
revoke all on pcm.reconciliacao_funcionario_gate from public,anon,authenticated,service_role;

create function pcm.sso_acesso_triagem_funcionario(p_cliente_id uuid,p_funcionario_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and auth.jwt()->>'user_role'='superadmin'
    and config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is true
    and exists(select 1 from pcm.visita_equipes ve join pcm.visitas v on v.id=ve.visita_id and v.cliente_id=ve.cliente_id
      where ve.cliente_id=p_cliente_id and ve.funcionario_id=p_funcionario_id and ve.encerrado_em is null)
$$;
revoke all on function pcm.sso_acesso_triagem_funcionario(uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_listar_sync_funcionarios_triagem(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(outbox_id uuid,funcionario_id uuid,estado text,tentativas integer,enfileirado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) or not coalesce((select habilitado from pcm.reconciliacao_funcionario_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or auth.jwt()->>'user_role' is distinct from 'superadmin' or p_cliente_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select q.id,q.row_id,q.status,q.attempts,q.enqueued_at from pcm.auvo_sync_outbox q
    where q.entity='funcionarios' and q.status in ('pending','processing','error') and (p_apos is null or q.id>p_apos)
      and pcm.sso_acesso_triagem_funcionario(p_cliente_id,q.row_id) is true order by q.id limit p_limite;
end $$;
revoke all on function pcm.sso_listar_sync_funcionarios_triagem(uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_anotar_sync_funcionario(p_request_id uuid,p_cliente_id uuid,p_outbox_id uuid,p_estado text,p_tentativas integer,p_observacao text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare q pcm.auvo_sync_outbox%rowtype; n pcm.reconciliacao_outbox_notas%rowtype;
begin
  if not coalesce((select habilitado from pcm.reconciliacao_outbox_gate where id),false) or not coalesce((select habilitado from pcm.reconciliacao_funcionario_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_outbox_id is null or p_estado is null or p_estado not in ('pending','processing','error')
    or p_tentativas is null or p_tentativas<0 or p_observacao is null or length(btrim(p_observacao)) not between 1 and 1000 then raise exception 'dados_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reconciliacao-nota:'||p_request_id::text,0));
  select * into q from pcm.auvo_sync_outbox where id=p_outbox_id and entity='funcionarios' for share;
  if not found or pcm.sso_acesso_triagem_funcionario(p_cliente_id,q.row_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into n from pcm.reconciliacao_outbox_notas where request_id=p_request_id;
  if found then
    if n.actor_id is distinct from auth.uid() or n.cliente_id is distinct from p_cliente_id or n.outbox_id is distinct from p_outbox_id
      or n.status_observado is distinct from p_estado or n.tentativas_observadas is distinct from p_tentativas or n.observacao is distinct from btrim(p_observacao) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('requestId',p_request_id,'outboxId',p_outbox_id,'autorizaRetry',false);
  end if;
  if q.status is distinct from p_estado or q.attempts is distinct from p_tentativas then raise exception 'origem_alterada' using errcode='40001'; end if;
  insert into pcm.reconciliacao_outbox_notas(request_id,outbox_id,cliente_id,actor_id,status_observado,tentativas_observadas,observacao)
    values(p_request_id,p_outbox_id,p_cliente_id,auth.uid(),p_estado,p_tentativas,btrim(p_observacao));
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'integracao.nota_funcionario','auvo_sync_outbox',p_outbox_id,
    jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'estado',p_estado,'tentativas',p_tentativas));
  return jsonb_build_object('requestId',p_request_id,'outboxId',p_outbox_id,'autorizaRetry',false);
end $$;
revoke all on function pcm.sso_anotar_sync_funcionario(uuid,uuid,uuid,text,integer,text) from public,anon,authenticated,service_role;
