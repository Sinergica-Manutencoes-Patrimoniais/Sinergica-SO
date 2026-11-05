-- ADR-1085: observação local; não envia, retenta ou confirma tarefa Auvo.
create table pcm.sso_observacao_os_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_observacao_os_gate(id,habilitado) values(true,false);
create table pcm.sso_observacoes_os(
 os_id uuid primary key references pcm.ordens_servico(id),cliente_id uuid not null references pcm.clientes(id),
 estado_local text not null check(estado_local in ('incerto','vinculo_observado_nao_confirmado')),
 sincronizacao text,possui_tarefa boolean not null,fonte_atualizada_em timestamptz not null,
 revisao integer not null check(revisao>0),atualizado_em timestamptz not null default now()
);
create table pcm.sso_observacoes_os_eventos(
 os_id uuid not null references pcm.sso_observacoes_os(os_id),revisao integer not null check(revisao>0),
 request_id uuid not null,ator_id uuid not null references auth.users(id),estado_local text not null,
 sincronizacao text,possui_tarefa boolean not null,fonte_atualizada_em timestamptz not null,criado_em timestamptz not null default now(),
 primary key(os_id,revisao),unique(request_id,os_id)
);
create table pcm.sso_observacoes_os_comandos(
 request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),
 payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_observacao_os_gate enable row level security;alter table pcm.sso_observacao_os_gate force row level security;
alter table pcm.sso_observacoes_os enable row level security;alter table pcm.sso_observacoes_os force row level security;
alter table pcm.sso_observacoes_os_eventos enable row level security;alter table pcm.sso_observacoes_os_eventos force row level security;
alter table pcm.sso_observacoes_os_comandos enable row level security;alter table pcm.sso_observacoes_os_comandos force row level security;
revoke all on pcm.sso_observacao_os_gate,pcm.sso_observacoes_os,pcm.sso_observacoes_os_eventos,pcm.sso_observacoes_os_comandos from public,anon,authenticated,service_role;
create trigger sso_observacoes_os_eventos_imutaveis before update or delete on pcm.sso_observacoes_os_eventos for each row execute function pcm.sso_proteger_nota_reconciliacao();
create trigger sso_observacoes_os_comandos_imutaveis before update or delete on pcm.sso_observacoes_os_comandos for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function pcm.sso_observar_os_reconciliacao(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_os_ids uuid[])
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ids uuid[];v_id uuid;v_os pcm.ordens_servico%rowtype;v_atual pcm.sso_observacoes_os%rowtype;
 v_cmd pcm.sso_observacoes_os_comandos%rowtype;v_payload jsonb;v_saida jsonb:='[]'::jsonb;v_resultado jsonb;
 v_estado text;v_fonte timestamptz;v_sync text;v_possui boolean;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null or p_os_ids is null
   or cardinality(p_os_ids) not between 1 and 50 or array_position(p_os_ids,null) is not null
   or (select count(distinct x) from unnest(p_os_ids) x)<>cardinality(p_os_ids) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_observacao_os_gate where id and habilitado for share;
 if not found then raise exception 'observacao_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.reconciliacao_outbox_gate where id and habilitado for share;
 if not found then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select array_agg(x order by x) into v_ids from unnest(p_os_ids) x;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'osIds',v_ids);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reconciliacao-observacao-os:'||p_request_id::text,0));
 select * into v_cmd from pcm.sso_observacoes_os_comandos where request_id=p_request_id;
 if found and (v_cmd.ator_id is distinct from p_ator_id or v_cmd.cliente_id is distinct from p_cliente_id or v_cmd.payload is distinct from v_payload)
   then raise exception 'request_id_conflitante' using errcode='23505'; end if;
 foreach v_id in array v_ids loop
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reconciliacao-observacao-os-item:'||v_id::text,0));
   select * into v_os from pcm.ordens_servico where id=v_id and client_id=p_cliente_id and deleted_at is null for share;
   if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
   if v_cmd.request_id is not null then continue; end if;
   v_fonte:=coalesce(v_os.updated_at,v_os.created_at);v_sync:=v_os.auvo_sync_status::text;v_possui:=v_os.auvo_task_id is not null;
   if v_fonte is null or not isfinite(v_fonte) then raise exception 'origem_invalida' using errcode='23514'; end if;
   v_estado:=case when v_possui then 'vinculo_observado_nao_confirmado' else 'incerto' end;
   select * into v_atual from pcm.sso_observacoes_os where os_id=v_id for update;
   if found and v_atual.cliente_id is distinct from p_cliente_id then raise exception 'origem_indisponivel' using errcode='42501'; end if;
   if v_atual.os_id is null then
     insert into pcm.sso_observacoes_os(os_id,cliente_id,estado_local,sincronizacao,possui_tarefa,fonte_atualizada_em,revisao)
       values(v_id,p_cliente_id,v_estado,v_sync,v_possui,v_fonte,1) returning * into v_atual;
     insert into pcm.sso_observacoes_os_eventos(os_id,revisao,request_id,ator_id,estado_local,sincronizacao,possui_tarefa,fonte_atualizada_em)
       values(v_id,1,p_request_id,p_ator_id,v_estado,v_sync,v_possui,v_fonte);
   elsif v_atual.estado_local is distinct from v_estado or v_atual.sincronizacao is distinct from v_sync or v_atual.possui_tarefa is distinct from v_possui or v_atual.fonte_atualizada_em is distinct from v_fonte then
     update pcm.sso_observacoes_os set estado_local=v_estado,sincronizacao=v_sync,possui_tarefa=v_possui,fonte_atualizada_em=v_fonte,
       revisao=revisao+1,atualizado_em=now() where os_id=v_id returning * into v_atual;
     insert into pcm.sso_observacoes_os_eventos(os_id,revisao,request_id,ator_id,estado_local,sincronizacao,possui_tarefa,fonte_atualizada_em)
       values(v_id,v_atual.revisao,p_request_id,p_ator_id,v_estado,v_sync,v_possui,v_fonte);
   end if;
   v_saida:=v_saida||jsonb_build_array(jsonb_build_object('osId',v_id,'revisao',v_atual.revisao,'estado',v_atual.estado_local));
 end loop;
 if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if v_cmd.request_id is not null then return v_cmd.resultado; end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'itens',v_saida,'efeitoRemotoComprovado',false);
 insert into pcm.sso_observacoes_os_comandos(request_id,ator_id,cliente_id,payload,resultado) values(p_request_id,p_ator_id,p_cliente_id,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'integracao.os_observadas','clientes',p_cliente_id,jsonb_build_object('requestId',p_request_id,'quantidade',cardinality(v_ids)));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_observar_os_reconciliacao(uuid,uuid,uuid,uuid[]) from public,anon,authenticated,service_role;
