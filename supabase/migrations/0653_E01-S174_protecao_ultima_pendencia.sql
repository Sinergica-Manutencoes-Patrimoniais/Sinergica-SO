-- ADR-0427: proteção opt-in; decisão excepcional transacional e auditada.
create table pcm.sso_ultima_pendencia_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_ultima_pendencia_gate(id,habilitado) values(true,false);
create table pcm.sso_decisoes_ultima_pendencia(
 request_id uuid primary key, composicao_id uuid not null references pcm.sso_backlog_composicoes(id),
 pendencia_id uuid not null references pcm.sso_pendencias_tecnicas(id), cliente_id uuid not null references pcm.clientes(id),
 revisao integer not null, motivo text not null check(length(btrim(motivo)) between 1 and 2000),
 ator_id uuid not null references auth.users(id), transacao bigint not null, criado_em timestamptz not null default now()
);
alter table pcm.sso_ultima_pendencia_gate enable row level security;
alter table pcm.sso_ultima_pendencia_gate force row level security;
alter table pcm.sso_decisoes_ultima_pendencia enable row level security;
alter table pcm.sso_decisoes_ultima_pendencia force row level security;
revoke all on pcm.sso_ultima_pendencia_gate,pcm.sso_decisoes_ultima_pendencia from public,anon,authenticated,service_role;
create function pcm.sso_decisoes_ultima_pendencia_imutaveis() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'historico_imutavel' using errcode='23514'; end; $$;
revoke all on function pcm.sso_decisoes_ultima_pendencia_imutaveis() from public,anon,authenticated,service_role;
create trigger sso_decisoes_ultima_pendencia_imutaveis before update or delete on pcm.sso_decisoes_ultima_pendencia for each row execute function pcm.sso_decisoes_ultima_pendencia_imutaveis();
create function pcm.sso_guardar_ultima_pendencia() returns trigger language plpgsql security definer set search_path='' as $$
declare v_c pcm.sso_backlog_composicoes%rowtype;
begin
 if not coalesce((select habilitado from pcm.sso_ultima_pendencia_gate where id),false) then return old; end if;
 select * into v_c from pcm.sso_backlog_composicoes where id=old.composicao_id for update;
 if exists(select 1 from pcm.sso_backlog_chamado_vinculos where composicao_id=old.composicao_id)
    and not exists(select 1 from pcm.sso_backlog_pendencias where composicao_id=old.composicao_id and pendencia_id<>old.pendencia_id) then
   if exists(select 1 from pcm.sso_backlog_parcelas where composicao_id=old.composicao_id)
      or not exists(select 1 from pcm.sso_decisoes_ultima_pendencia d where d.composicao_id=old.composicao_id and d.pendencia_id=old.pendencia_id and d.cliente_id=v_c.cliente_id and d.revisao=v_c.revisao and d.ator_id=auth.uid() and d.transacao=pg_catalog.txid_current()) then
     raise exception 'ultima_pendencia_vinculada_protegida' using errcode='23514';
   end if;
 end if;
 return old;
end; $$;
revoke all on function pcm.sso_guardar_ultima_pendencia() from public,anon,authenticated,service_role;
create trigger sso_guardar_ultima_pendencia before delete on pcm.sso_backlog_pendencias for each row execute function pcm.sso_guardar_ultima_pendencia();
create function pcm.sso_retirar_ultima_pendencia_vinculada(p_request_id uuid,p_composicao_id uuid,p_pendencia_id uuid,p_revision integer,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_c pcm.sso_backlog_composicoes%rowtype; v_d pcm.sso_decisoes_ultima_pendencia%rowtype; v_resultado jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_ultima_pendencia_gate where id),false) then raise exception 'protecao_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_request_id is null or p_composicao_id is null or p_pendencia_id is null or p_revision is null or p_revision<1 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ultima-pendencia:'||p_request_id::text,0));
 select * into v_c from pcm.sso_backlog_composicoes where id=p_composicao_id for update;
 if not found or config.sso_autorizar_acao('execucao.validar',v_c.cliente_id) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',v_c.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_d from pcm.sso_decisoes_ultima_pendencia where request_id=p_request_id;
 if found then
   if v_d.ator_id is distinct from auth.uid() or v_d.composicao_id is distinct from p_composicao_id or v_d.pendencia_id is distinct from p_pendencia_id or v_d.revisao is distinct from p_revision or v_d.motivo is distinct from btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
   return pcm.sso_retirar_pendencia_composicao(p_request_id,p_composicao_id,p_pendencia_id,p_revision,p_motivo);
 end if;
 if v_c.revisao<>p_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if not exists(select 1 from pcm.sso_backlog_chamado_vinculos where composicao_id=p_composicao_id) or not exists(select 1 from pcm.sso_backlog_pendencias where composicao_id=p_composicao_id and pendencia_id=p_pendencia_id) or exists(select 1 from pcm.sso_backlog_pendencias where composicao_id=p_composicao_id and pendencia_id<>p_pendencia_id) or exists(select 1 from pcm.sso_backlog_parcelas where composicao_id=p_composicao_id) then raise exception 'excecao_indisponivel' using errcode='23514'; end if;
 insert into pcm.sso_decisoes_ultima_pendencia(request_id,composicao_id,pendencia_id,cliente_id,revisao,motivo,ator_id,transacao) values(p_request_id,p_composicao_id,p_pendencia_id,v_c.cliente_id,p_revision,btrim(p_motivo),auth.uid(),pg_catalog.txid_current());
 v_resultado:=pcm.sso_retirar_pendencia_composicao(p_request_id,p_composicao_id,p_pendencia_id,p_revision,p_motivo);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'backlog.ultima_pendencia_retirada','sso_backlog_composicoes',p_composicao_id,jsonb_build_object('requestId',p_request_id,'pendenciaId',p_pendencia_id,'clienteId',v_c.cliente_id,'revisao',p_revision,'motivo',btrim(p_motivo)));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_retirar_ultima_pendencia_vinculada(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
