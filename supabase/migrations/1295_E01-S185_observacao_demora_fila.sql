-- ADR-1130: registro local, sem decidir lease, retry ou efeito remoto.
create table pcm.sso_demora_fila_config(id boolean primary key default true check(id),habilitado boolean not null default false,
 limite_minutos integer check(limite_minutos between 1 and 10080));
insert into pcm.sso_demora_fila_config(id,habilitado,limite_minutos) values(true,false,null);
create table pcm.sso_demora_fila_observacoes(
 outbox_id uuid primary key references pcm.auvo_sync_outbox(id),cliente_id uuid not null references pcm.clientes(id),
 entidade text not null,objeto_id uuid not null,estado text not null check(estado in ('inicio_desconhecido','tempo_excedido_observado','processamento_encerrado_na_fonte','novo_processamento_observado')),
 iniciado_em timestamptz,limite_minutos integer not null check(limite_minutos between 1 and 10080),revisao integer not null check(revisao>0),atualizado_em timestamptz not null default now()
);
create table pcm.sso_demora_fila_eventos(
 outbox_id uuid not null references pcm.sso_demora_fila_observacoes(outbox_id),revisao integer not null,request_id uuid not null,
 cliente_id uuid not null references pcm.clientes(id),estado text not null,iniciado_em timestamptz,limite_minutos integer not null,criado_em timestamptz not null default now(),
 primary key(outbox_id,revisao),unique(outbox_id,request_id)
);
alter table pcm.sso_demora_fila_config enable row level security;alter table pcm.sso_demora_fila_config force row level security;
alter table pcm.sso_demora_fila_observacoes enable row level security;alter table pcm.sso_demora_fila_observacoes force row level security;
alter table pcm.sso_demora_fila_eventos enable row level security;alter table pcm.sso_demora_fila_eventos force row level security;
revoke all on pcm.sso_demora_fila_config,pcm.sso_demora_fila_observacoes,pcm.sso_demora_fila_eventos from public,anon,authenticated,service_role;
create trigger sso_demora_fila_eventos_imutaveis before update or delete on pcm.sso_demora_fila_eventos for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function pcm.sso_observar_demora_fila(p_request_id uuid,p_outbox_id uuid,p_cliente_id uuid) returns void
language plpgsql volatile security definer set search_path='' as $$
declare v_config pcm.sso_demora_fila_config%rowtype;v_outbox pcm.auvo_sync_outbox%rowtype;v_atual pcm.sso_demora_fila_observacoes%rowtype;v_estado text;
begin
 select * into v_config from pcm.sso_demora_fila_config where id for share;
 if not found or not v_config.habilitado then return; end if;
 if v_config.limite_minutos is null then raise exception 'limite_demora_nao_configurado' using errcode='55000'; end if;
 if p_request_id is null or p_outbox_id is null or p_cliente_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 select * into v_outbox from pcm.auvo_sync_outbox where id=p_outbox_id for update;
 if not found or v_outbox.entity not in ('sistemas','equipamentos') then raise exception 'origem_indisponivel' using errcode='23514'; end if;
 if not ((v_outbox.entity='sistemas' and exists(select 1 from pcm.sistemas where id=v_outbox.row_id and cliente_id=p_cliente_id))
  or (v_outbox.entity='equipamentos' and exists(select 1 from pcm.equipamentos where id=v_outbox.row_id and client_id=p_cliente_id))) then raise exception 'origem_alterada' using errcode='40001'; end if;
 select * into v_atual from pcm.sso_demora_fila_observacoes where outbox_id=p_outbox_id for update;
 if found and (v_atual.cliente_id is distinct from p_cliente_id or v_atual.entidade is distinct from v_outbox.entity or v_atual.objeto_id is distinct from v_outbox.row_id) then
  raise exception 'origem_exige_reconciliacao' using errcode='23514'; end if;
 if v_outbox.status='processing' and v_outbox.processamento_iniciado_em is null then v_estado:='inicio_desconhecido';
 elsif v_outbox.status='processing' and v_outbox.processamento_iniciado_em<=now()-pg_catalog.make_interval(mins=>v_config.limite_minutos) then v_estado:='tempo_excedido_observado';
 elsif v_atual.outbox_id is not null and v_outbox.status='processing' then v_estado:='novo_processamento_observado';
 elsif v_atual.outbox_id is not null then v_estado:='processamento_encerrado_na_fonte';
 else return; end if;
 if v_atual.outbox_id is null then
  insert into pcm.sso_demora_fila_observacoes(outbox_id,cliente_id,entidade,objeto_id,estado,iniciado_em,limite_minutos,revisao)
   values(p_outbox_id,p_cliente_id,v_outbox.entity,v_outbox.row_id,v_estado,v_outbox.processamento_iniciado_em,v_config.limite_minutos,1) returning * into v_atual;
 elsif v_atual.estado is distinct from v_estado or v_atual.iniciado_em is distinct from v_outbox.processamento_iniciado_em or v_atual.limite_minutos is distinct from v_config.limite_minutos then
  update pcm.sso_demora_fila_observacoes set estado=v_estado,iniciado_em=v_outbox.processamento_iniciado_em,limite_minutos=v_config.limite_minutos,
   revisao=revisao+1,atualizado_em=now() where outbox_id=p_outbox_id returning * into v_atual;
 else return; end if;
 insert into pcm.sso_demora_fila_eventos(outbox_id,revisao,request_id,cliente_id,estado,iniciado_em,limite_minutos)
  values(p_outbox_id,v_atual.revisao,p_request_id,p_cliente_id,v_atual.estado,v_atual.iniciado_em,v_atual.limite_minutos);
end; $$;
revoke all on function pcm.sso_observar_demora_fila(uuid,uuid,uuid) from public,anon,authenticated,service_role;
