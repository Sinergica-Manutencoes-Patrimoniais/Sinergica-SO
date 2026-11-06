-- ADR-1132: evidência privada; nenhuma transferência de histórico.
create table pcm.sso_quarentena_fila_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_quarentena_fila_gate(id,habilitado) values(true,false);
create table pcm.sso_conflitos_propriedade_fila(
 outbox_id uuid primary key references pcm.auvo_sync_outbox(id),cliente_historico_id uuid not null references pcm.clientes(id),
 cliente_atual_id uuid not null references pcm.clientes(id),entidade text not null,objeto_id uuid not null,fonte text not null check(fonte in ('ocorrencia','demora')),
 revisao integer not null check(revisao>0),atualizado_em timestamptz not null default now(),check(cliente_historico_id<>cliente_atual_id)
);
create table pcm.sso_conflitos_propriedade_fila_eventos(
 outbox_id uuid not null references pcm.sso_conflitos_propriedade_fila(outbox_id),revisao integer not null,request_id uuid not null,
 cliente_historico_id uuid not null references pcm.clientes(id),cliente_atual_id uuid not null references pcm.clientes(id),
 entidade text not null,objeto_id uuid not null,fonte text not null,criado_em timestamptz not null default now(),
 primary key(outbox_id,revisao),unique(outbox_id,request_id)
);
alter table pcm.sso_quarentena_fila_gate enable row level security;alter table pcm.sso_quarentena_fila_gate force row level security;
alter table pcm.sso_conflitos_propriedade_fila enable row level security;alter table pcm.sso_conflitos_propriedade_fila force row level security;
alter table pcm.sso_conflitos_propriedade_fila_eventos enable row level security;alter table pcm.sso_conflitos_propriedade_fila_eventos force row level security;
revoke all on pcm.sso_quarentena_fila_gate,pcm.sso_conflitos_propriedade_fila,pcm.sso_conflitos_propriedade_fila_eventos from public,anon,authenticated,service_role;
create trigger sso_conflitos_fila_eventos_imutaveis before update or delete on pcm.sso_conflitos_propriedade_fila_eventos for each row execute function pcm.sso_proteger_nota_reconciliacao();
create function pcm.sso_quarentenar_propriedade_fila(p_request_id uuid,p_outbox_id uuid,p_cliente_historico uuid,p_cliente_atual uuid,p_fonte text)
returns void language plpgsql volatile security definer set search_path='' as $$
declare v_outbox pcm.auvo_sync_outbox%rowtype;v_atual pcm.sso_conflitos_propriedade_fila%rowtype;
begin
 if p_request_id is null or p_outbox_id is null or p_cliente_historico is null or p_cliente_atual is null or p_cliente_historico=p_cliente_atual
  or p_fonte is null or p_fonte not in ('ocorrencia','demora') then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform 1 from pcm.sso_quarentena_fila_gate where id and habilitado for share;
 if not found then raise exception 'origem_exige_reconciliacao' using errcode='23514'; end if;
 select * into v_outbox from pcm.auvo_sync_outbox where id=p_outbox_id for update;
 if not found or v_outbox.entity not in ('sistemas','equipamentos') then raise exception 'origem_indisponivel' using errcode='23514'; end if;
 if not ((v_outbox.entity='sistemas' and exists(select 1 from pcm.sistemas where id=v_outbox.row_id and cliente_id=p_cliente_atual))
  or (v_outbox.entity='equipamentos' and exists(select 1 from pcm.equipamentos where id=v_outbox.row_id and client_id=p_cliente_atual))) then raise exception 'origem_alterada' using errcode='40001'; end if;
 if p_fonte='ocorrencia' and not exists(select 1 from pcm.sso_ocorrencias_fila where outbox_id=p_outbox_id and cliente_id=p_cliente_historico)
  or p_fonte='demora' and not exists(select 1 from pcm.sso_demora_fila_observacoes where outbox_id=p_outbox_id and cliente_id=p_cliente_historico) then raise exception 'historico_indisponivel' using errcode='23514'; end if;
 select * into v_atual from pcm.sso_conflitos_propriedade_fila where outbox_id=p_outbox_id for update;
 if not found then
  insert into pcm.sso_conflitos_propriedade_fila(outbox_id,cliente_historico_id,cliente_atual_id,entidade,objeto_id,fonte,revisao)
   values(p_outbox_id,p_cliente_historico,p_cliente_atual,v_outbox.entity,v_outbox.row_id,p_fonte,1) returning * into v_atual;
 elsif v_atual.cliente_historico_id is distinct from p_cliente_historico or v_atual.cliente_atual_id is distinct from p_cliente_atual
  or v_atual.entidade is distinct from v_outbox.entity or v_atual.objeto_id is distinct from v_outbox.row_id or v_atual.fonte is distinct from p_fonte then
  update pcm.sso_conflitos_propriedade_fila set cliente_historico_id=p_cliente_historico,cliente_atual_id=p_cliente_atual,entidade=v_outbox.entity,
   objeto_id=v_outbox.row_id,fonte=p_fonte,revisao=revisao+1,atualizado_em=now() where outbox_id=p_outbox_id returning * into v_atual;
 else return; end if;
 insert into pcm.sso_conflitos_propriedade_fila_eventos(outbox_id,revisao,request_id,cliente_historico_id,cliente_atual_id,entidade,objeto_id,fonte)
  values(p_outbox_id,v_atual.revisao,p_request_id,p_cliente_historico,p_cliente_atual,v_outbox.entity,v_outbox.row_id,p_fonte);
end; $$;
revoke all on function pcm.sso_quarentenar_propriedade_fila(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
