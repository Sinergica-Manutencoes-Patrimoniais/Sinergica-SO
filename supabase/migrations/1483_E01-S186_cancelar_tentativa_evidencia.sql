-- ADR-1333: cancela apenas tentativa, não altera evidência existente.
create table pcm.sso_cancelamento_evidencia_onda_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_cancelamento_evidencia_onda_gate(id,habilitado) values(true,false);
create table pcm.sso_evidencias_onda_canceladas(
 request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),
 onda smallint not null check(onda between 1 and 6),cancelado_em timestamptz not null default now()
);
alter table pcm.sso_cancelamento_evidencia_onda_gate enable row level security;
alter table pcm.sso_cancelamento_evidencia_onda_gate force row level security;
alter table pcm.sso_evidencias_onda_canceladas enable row level security;
alter table pcm.sso_evidencias_onda_canceladas force row level security;
revoke all on pcm.sso_cancelamento_evidencia_onda_gate,pcm.sso_evidencias_onda_canceladas from public,anon,authenticated,service_role;
create trigger sso_evidencias_onda_canceladas_imutaveis before update or delete on pcm.sso_evidencias_onda_canceladas
for each row execute function pcm.sso_evidencia_onda_imutavel();

create function pcm.sso_exigir_evidencia_onda_nao_cancelada(p_request_id uuid) returns void
language plpgsql volatile security definer set search_path='' as $$
begin
 if exists(select 1 from pcm.sso_evidencias_onda_canceladas where request_id=p_request_id) then raise exception 'tentativa_cancelada' using errcode='55000'; end if;
end; $$;
revoke all on function pcm.sso_exigir_evidencia_onda_nao_cancelada(uuid) from public,anon,authenticated,service_role;
do $alteracao$
declare v_def text:=pg_catalog.pg_get_functiondef('pcm.sso_registrar_evidencia_onda(uuid,uuid,smallint,integer,text,text,text,timestamptz,text,text[],text[],text)'::regprocedure);
 v_marcador text:='perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(''evidencia-onda:'' || p_request_id::text, 0));';
begin
 if strpos(v_def,v_marcador)=0 or length(v_def)-length(replace(v_def,v_marcador,''))<>length(v_marcador)
   or strpos(v_def,'sso_exigir_evidencia_onda_nao_cancelada')>0 then raise exception 'definicao_evidencia_incompativel' using errcode='55000'; end if;
 execute replace(v_def,v_marcador,v_marcador||' perform pcm.sso_exigir_evidencia_onda_nao_cancelada(p_request_id);');
end;
$alteracao$;

create function pcm.sso_cancelar_tentativa_evidencia_onda(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_onda smallint)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_evidencia pcm.sso_evidencias_ondas%rowtype;v_cancelada pcm.sso_evidencias_onda_canceladas%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null or p_onda is null or p_onda not between 1 and 6 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_cancelamento_evidencia_onda_gate where id and habilitado for share;
 if not found then raise exception 'cancelamento_desabilitado' using errcode='55000'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('evidencia-onda:'||p_request_id::text,0));
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_evidencia from pcm.sso_evidencias_ondas where request_id=p_request_id;
 if found then
   if v_evidencia.executor_id is distinct from p_ator_id or v_evidencia.cliente_id is distinct from p_cliente_id or v_evidencia.onda is distinct from p_onda then raise exception 'request_id_conflitante' using errcode='23505'; end if;
   return jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'onda',p_onda,'estado','confirmado');
 end if;
 select * into v_cancelada from pcm.sso_evidencias_onda_canceladas where request_id=p_request_id;
 if found then
   if v_cancelada.ator_id is distinct from p_ator_id or v_cancelada.cliente_id is distinct from p_cliente_id or v_cancelada.onda is distinct from p_onda then raise exception 'request_id_conflitante' using errcode='23505'; end if;
 else
   insert into pcm.sso_evidencias_onda_canceladas(request_id,ator_id,cliente_id,onda) values(p_request_id,p_ator_id,p_cliente_id,p_onda);
   insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'homologacao.tentativa_evidencia_cancelada','clientes',p_cliente_id,jsonb_build_object('requestId',p_request_id,'onda',p_onda));
 end if;
 return jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'onda',p_onda,'estado','cancelado');
end; $$;
revoke all on function pcm.sso_cancelar_tentativa_evidencia_onda(uuid,uuid,uuid,smallint) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_cancelar_tentativa_evidencia_onda(uuid,uuid,uuid,smallint) to authenticated;
