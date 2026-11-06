-- ADR-1283: exceção restrita e gate fechado; não alterar tarefa ou OS no cancelamento.
create table pcm.sso_cancelamento_campo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_cancelamento_campo_gate(id,habilitado) values(true,false);
create table pcm.sso_cancelamentos_campo(
  request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),
  chamado_id uuid not null unique references pcm.chamados(id),os_id uuid not null unique references pcm.ordens_servico(id),
  motivo text not null,payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_cancelamento_campo_gate enable row level security;
alter table pcm.sso_cancelamento_campo_gate force row level security;
alter table pcm.sso_cancelamentos_campo enable row level security;
alter table pcm.sso_cancelamentos_campo force row level security;
revoke all on pcm.sso_cancelamento_campo_gate,pcm.sso_cancelamentos_campo from public,anon,authenticated,service_role;
create trigger sso_cancelamentos_campo_imutaveis before update or delete on pcm.sso_cancelamentos_campo for each row execute function pcm.sso_proteger_conferencia_levantamento();

create or replace function pcm.sso_guardar_vinculo_os_cancelado() returns trigger language plpgsql security definer set search_path='' as $$
declare v_gate boolean;v_chamado record;v_antigo uuid;v_novo uuid;v_antigo_os uuid;v_os uuid;
begin
  select habilitado into v_gate from pcm.sso_guarda_cancelado_gate where id for share;
  if not coalesce(v_gate,false) then if tg_op='DELETE' then return old; end if; return new; end if;
  if tg_op='DELETE' then v_antigo:=old.chamado_id;v_antigo_os:=old.id;v_os:=old.id;
  elsif tg_op='INSERT' then v_novo:=new.chamado_id;v_os:=new.id;
  else
    if new.id is not distinct from old.id and new.chamado_id is not distinct from old.chamado_id and new.client_id is not distinct from old.client_id
      and new.deleted_at is not distinct from old.deleted_at and (new.status is not distinct from old.status or new.status='finalizado') then return new; end if;
    if new.id is not distinct from old.id and new.chamado_id is not distinct from old.chamado_id and new.client_id is not distinct from old.client_id
      and new.deleted_at is not distinct from old.deleted_at and new.status in ('solicitacao','corretiva','backlog','em_execucao')
      and exists(select 1 from pcm.sso_cancelamentos_campo x join pcm.sso_cancelamento_campo_gate g on g.id and g.habilitado
        where x.os_id=old.id and x.chamado_id=old.chamado_id and x.cliente_id=old.client_id)
      and not exists(select 1 from pcm.chamados c where c.id<>old.chamado_id and c.status='cancelado' and (c.id=new.chamado_id or c.ordem_servico_id=new.id)) then return new; end if;
    v_antigo:=old.chamado_id;v_novo:=new.chamado_id;v_antigo_os:=old.id;v_os:=new.id;
  end if;
  for v_chamado in select c.id,c.status from pcm.chamados c where c.id=v_antigo or c.id=v_novo or c.ordem_servico_id=v_antigo_os or c.ordem_servico_id=v_os order by c.id for share loop
    if v_chamado.status='cancelado' then raise exception 'chamado_cancelado_requer_tratamento_formal' using errcode='23514'; end if;
  end loop;
  if tg_op='DELETE' then return old; end if; return new;
end; $$;
revoke all on function pcm.sso_guardar_vinculo_os_cancelado() from public,anon,authenticated,service_role;

create function pcm.sso_cancelar_chamado_campo_preservado(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_os_id uuid,p_chamado_id uuid,
  p_expected_revision bigint,p_os_updated_at timestamptz,p_task_id bigint,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare c pcm.chamados%rowtype;o pcm.ordens_servico%rowtype;ant pcm.sso_cancelamentos_campo%rowtype;payload jsonb;resultado jsonb;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null or p_os_id is null or p_chamado_id is null
    or p_expected_revision is null or p_expected_revision<1 or p_task_id is null or p_task_id<1 or length(btrim(coalesce(p_motivo,''))) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_cancelamento_campo_gate where id and habilitado for share;
  if not found then raise exception 'cancelamento_desabilitado' using errcode='55000'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.encerrar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  payload:=jsonb_build_object('clienteId',p_cliente_id,'osId',p_os_id,'chamadoId',p_chamado_id,'expectedRevision',p_expected_revision,'osUpdatedAt',p_os_updated_at,'taskId',p_task_id::text,'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-cancelamento-campo:'||p_request_id::text,0));
  select * into ant from pcm.sso_cancelamentos_campo where request_id=p_request_id;
  if found then
    if ant.ator_id is distinct from p_ator_id or ant.cliente_id is distinct from p_cliente_id or ant.payload is distinct from payload then raise exception 'request_conflitante' using errcode='23505'; end if;
    if not exists(select 1 from pcm.ordens_servico x where x.id=ant.os_id and x.client_id=p_cliente_id and x.chamado_id=ant.chamado_id and x.deleted_at is null) then raise exception 'os_indisponivel' using errcode='42501'; end if;
    return ant.resultado;
  end if;
  if not exists(select 1 from pcm.sso_origem_campo_processamentos p where p.os_id=p_os_id and p.cliente_id=p_cliente_id and p.chamado_id=p_chamado_id and p.provisorio) then raise exception 'origem_indisponivel' using errcode='42501'; end if;
  select * into c from pcm.chamados where id=p_chamado_id and cliente_id=p_cliente_id and deleted_at is null for update;
  if not found or c.status='cancelado' or c.sso_encerrado_em is not null then raise exception 'chamado_indisponivel' using errcode='23514'; end if;
  if c.sso_revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  select * into o from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and chamado_id=p_chamado_id and deleted_at is null for update;
  if not found or o.auvo_task_id is distinct from p_task_id or o.updated_at is distinct from p_os_updated_at then raise exception 'os_alterada' using errcode='40001'; end if;
  if c.ordem_servico_id is distinct from o.id or exists(select 1 from pcm.ordens_servico x where x.chamado_id=c.id and x.id<>o.id and x.deleted_at is null)
    or exists(select 1 from pcm.chamado_escopo_composicoes x where x.chamado_id=c.id) then raise exception 'origem_requer_reconciliacao' using errcode='23514'; end if;
  update pcm.chamados set status='cancelado',cancelamento_justificativa=btrim(p_motivo),updated_at=now(),updated_by=p_ator_id where id=c.id returning * into c;
  resultado:=jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'chamadoId',c.id,'osId',o.id,'revision',c.sso_revisao,
    'estado','cancelado','osAlterada',false,'tarefaAlterada',false,'execucaoAlterada',false);
  insert into pcm.sso_cancelamentos_campo(request_id,ator_id,cliente_id,chamado_id,os_id,motivo,payload,resultado) values(p_request_id,p_ator_id,p_cliente_id,c.id,o.id,btrim(p_motivo),payload,resultado);
  insert into pcm.chamados_eventos(chamado_id,tipo,metadata,created_by) values(c.id,'cancelado',jsonb_build_object('origemCampo',true,'osPreservada',o.id,'motivo',btrim(p_motivo)),p_ator_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'origem_campo.chamado_cancelado_preservado','chamados',c.id,resultado||jsonb_build_object('motivo',btrim(p_motivo)));
  return resultado;
end; $$;
revoke all on function pcm.sso_cancelar_chamado_campo_preservado(uuid,uuid,uuid,uuid,uuid,bigint,timestamptz,bigint,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_cancelar_chamado_campo_preservado(uuid,uuid,uuid,uuid,uuid,bigint,timestamptz,bigint,text) to authenticated;
