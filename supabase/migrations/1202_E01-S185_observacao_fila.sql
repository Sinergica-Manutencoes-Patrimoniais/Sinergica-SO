-- ADR-1051: observação da fila, sem dispatch ou confirmação remota.
create table pcm.sso_observacao_fila_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_observacao_fila_gate(id,habilitado) values(true,false);
create table pcm.sso_ocorrencias_fila (
  outbox_id uuid primary key references pcm.auvo_sync_outbox(id),cliente_id uuid not null references pcm.clientes(id),
  entidade text not null check(entidade in ('sistemas','equipamentos')),objeto_id uuid not null,
  estado text not null check(estado in ('pendente','incerto','enviado_nao_confirmado')),
  estado_fonte text not null check(estado_fonte in ('pending','processing','error','sent')),
  tentativas integer not null check(tentativas>=0),revisao integer not null check(revisao>0),atualizado_em timestamptz not null default now()
);
create table pcm.sso_ocorrencias_fila_eventos (
  outbox_id uuid not null references pcm.sso_ocorrencias_fila(outbox_id),revisao integer not null check(revisao>0),
  request_id uuid not null,ator_id uuid not null references auth.users(id),estado text not null,
  estado_fonte text not null,tentativas integer not null check(tentativas>=0),criado_em timestamptz not null default now(),
  primary key(outbox_id,revisao),unique(request_id,outbox_id)
);
create table pcm.sso_observacao_fila_comandos (
  request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),
  payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_observacao_fila_gate enable row level security;alter table pcm.sso_observacao_fila_gate force row level security;
alter table pcm.sso_ocorrencias_fila enable row level security;alter table pcm.sso_ocorrencias_fila force row level security;
alter table pcm.sso_ocorrencias_fila_eventos enable row level security;alter table pcm.sso_ocorrencias_fila_eventos force row level security;
alter table pcm.sso_observacao_fila_comandos enable row level security;alter table pcm.sso_observacao_fila_comandos force row level security;
revoke all on pcm.sso_observacao_fila_gate,pcm.sso_ocorrencias_fila,pcm.sso_ocorrencias_fila_eventos,pcm.sso_observacao_fila_comandos from public,anon,authenticated,service_role;
create trigger sso_ocorrencias_fila_eventos_imutaveis before update or delete on pcm.sso_ocorrencias_fila_eventos for each row execute function pcm.sso_proteger_nota_reconciliacao();
create trigger sso_observacao_fila_comandos_imutaveis before update or delete on pcm.sso_observacao_fila_comandos for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function pcm.sso_observar_fila_reconciliacao(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_outbox_ids uuid[])
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_id uuid;v_outbox pcm.auvo_sync_outbox%rowtype;v_atual pcm.sso_ocorrencias_fila%rowtype;
  v_cmd pcm.sso_observacao_fila_comandos%rowtype;v_estado text;v_payload jsonb;v_saida jsonb:='[]'::jsonb;v_resultado jsonb;v_ids uuid[];
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null or p_outbox_ids is null
    or cardinality(p_outbox_ids) not between 1 and 50 or array_position(p_outbox_ids,null) is not null
    or (select count(distinct x) from unnest(p_outbox_ids) x)<>cardinality(p_outbox_ids) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_observacao_fila_gate where id and habilitado for share;if not found then raise exception 'observacao_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.reconciliacao_outbox_gate where id and habilitado for share;if not found then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select array_agg(x order by x) into v_ids from unnest(p_outbox_ids) x;
  v_payload:=jsonb_build_object('clienteId',p_cliente_id,'ids',v_ids);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reconciliacao-observacao:'||p_request_id::text,0));
  select * into v_cmd from pcm.sso_observacao_fila_comandos where request_id=p_request_id;
  if found then
    if v_cmd.ator_id is distinct from p_ator_id or v_cmd.cliente_id is distinct from p_cliente_id or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    foreach v_id in array v_ids loop
      select * into v_outbox from pcm.auvo_sync_outbox where id=v_id for share;
      if not found or v_outbox.entity not in ('sistemas','equipamentos') then raise exception 'origem_indisponivel' using errcode='42501'; end if;
      if v_outbox.entity='sistemas' then
        perform 1 from pcm.sistemas where id=v_outbox.row_id and cliente_id=p_cliente_id for share;
      else
        perform 1 from pcm.equipamentos where id=v_outbox.row_id and client_id=p_cliente_id for share;
      end if;
      if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
    end loop;
    if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
    return v_cmd.resultado;
  end if;
  foreach v_id in array v_ids loop
    select * into v_outbox from pcm.auvo_sync_outbox where id=v_id for share;
    if not found or v_outbox.entity not in ('sistemas','equipamentos') or v_outbox.status not in ('pending','processing','error','sent') or v_outbox.attempts is null or v_outbox.attempts<0 then raise exception 'origem_indisponivel' using errcode='42501'; end if;
    if v_outbox.entity='sistemas' then
      perform 1 from pcm.sistemas where id=v_outbox.row_id and cliente_id=p_cliente_id for share;
    else
      perform 1 from pcm.equipamentos where id=v_outbox.row_id and client_id=p_cliente_id for share;
    end if;
    if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
    v_estado:=case v_outbox.status when 'pending' then 'pendente' when 'sent' then 'enviado_nao_confirmado' else 'incerto' end;
    select * into v_atual from pcm.sso_ocorrencias_fila where outbox_id=v_id for update;
    if found and (v_atual.cliente_id is distinct from p_cliente_id or v_atual.entidade is distinct from v_outbox.entity or v_atual.objeto_id is distinct from v_outbox.row_id) then raise exception 'origem_indisponivel' using errcode='42501'; end if;
    if v_atual.outbox_id is null then
      insert into pcm.sso_ocorrencias_fila(outbox_id,cliente_id,entidade,objeto_id,estado,estado_fonte,tentativas,revisao)
        values(v_id,p_cliente_id,v_outbox.entity,v_outbox.row_id,v_estado,v_outbox.status,v_outbox.attempts,1) returning * into v_atual;
      insert into pcm.sso_ocorrencias_fila_eventos(outbox_id,revisao,request_id,ator_id,estado,estado_fonte,tentativas) values(v_id,1,p_request_id,p_ator_id,v_estado,v_outbox.status,v_outbox.attempts);
    elsif v_atual.estado is distinct from v_estado or v_atual.estado_fonte is distinct from v_outbox.status or v_atual.tentativas is distinct from v_outbox.attempts then
      update pcm.sso_ocorrencias_fila set estado=v_estado,estado_fonte=v_outbox.status,tentativas=v_outbox.attempts,revisao=revisao+1,atualizado_em=now() where outbox_id=v_id returning * into v_atual;
      insert into pcm.sso_ocorrencias_fila_eventos(outbox_id,revisao,request_id,ator_id,estado,estado_fonte,tentativas) values(v_id,v_atual.revisao,p_request_id,p_ator_id,v_estado,v_outbox.status,v_outbox.attempts);
    end if;
    v_saida:=v_saida||jsonb_build_array(jsonb_build_object('outboxId',v_id,'revisao',v_atual.revisao,'estado',v_atual.estado,'estadoFonte',v_atual.estado_fonte,'tentativas',v_atual.tentativas));
  end loop;
  if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_resultado:=jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'itens',v_saida,'efeitoRemotoComprovado',false);
  insert into pcm.sso_observacao_fila_comandos(request_id,ator_id,cliente_id,payload,resultado) values(p_request_id,p_ator_id,p_cliente_id,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'integracao.observacao_fila','sso_observacao_fila_comandos',p_request_id,jsonb_build_object('clienteId',p_cliente_id,'quantidade',cardinality(v_ids)));
  return v_resultado;
end; $$;
revoke all on function pcm.sso_observar_fila_reconciliacao(uuid,uuid,uuid,uuid[]) from public,anon,authenticated,service_role;
