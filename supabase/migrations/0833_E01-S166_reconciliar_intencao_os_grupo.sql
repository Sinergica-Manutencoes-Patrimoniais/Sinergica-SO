-- ADR-0608: decisão explícita antes de vincular OS existente a intenção já registrada.
create table pcm.sso_reconciliacao_intencao_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_reconciliacao_intencao_grupo_gate enable row level security;
alter table pcm.sso_reconciliacao_intencao_grupo_gate force row level security;
revoke all on pcm.sso_reconciliacao_intencao_grupo_gate from public,anon,authenticated,service_role;
insert into pcm.sso_reconciliacao_intencao_grupo_gate(id,habilitado) values(true,false);
create table pcm.sso_decisoes_intencao_grupo (
 request_id uuid primary key,intencao_id uuid not null unique references pcm.sso_intencoes_os_grupo(id),cliente_id uuid not null references pcm.clientes(id),
 os_id uuid not null references pcm.ordens_servico(id),motivo text not null,ator_id uuid not null references auth.users(id),payload jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_decisoes_intencao_grupo enable row level security;
alter table pcm.sso_decisoes_intencao_grupo force row level security;
revoke all on pcm.sso_decisoes_intencao_grupo from public,anon,authenticated,service_role;
create trigger sso_decisao_intencao_grupo_imutavel before update or delete on pcm.sso_decisoes_intencao_grupo for each row execute function pcm.sso_proteger_conferencia_levantamento();
create function pcm.sso_decidir_vinculo_intencao_grupo(p_request_id uuid,p_cliente_id uuid,p_intencao_id uuid,p_os_id uuid,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_intencao pcm.sso_intencoes_os_grupo%rowtype;v_ant pcm.sso_decisoes_intencao_grupo%rowtype;v_payload jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if not coalesce((select habilitado from pcm.sso_reconciliacao_intencao_grupo_gate where id),false) then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
 if v_ator is null or p_request_id is null or p_cliente_id is null or p_intencao_id is null or p_os_id is null or v_motivo is null or length(v_motivo)>2000 then raise exception 'pedido_invalido' using errcode='22023'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'intencaoId',p_intencao_id,'osId',p_os_id,'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('decisao-intencao-grupo:'||p_request_id::text,0));
 select * into v_ant from pcm.sso_decisoes_intencao_grupo where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_ator or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return jsonb_build_object('requestId',p_request_id,'decisaoRegistrada',true,'vinculoCriado',false,'osAlterada',false); end if;
 select * into v_intencao from pcm.sso_intencoes_os_grupo where id=p_intencao_id and cliente_id=p_cliente_id;
 if not found then raise exception 'intencao_indisponivel' using errcode='42501'; end if;
 perform 1 from pcm.sso_ocorrencias_grupo where id=v_intencao.ocorrencia_grupo_id and cliente_id=p_cliente_id for update;
 if not found or exists(select 1 from pcm.sso_vinculos_os_grupo where ocorrencia_grupo_id=v_intencao.ocorrencia_grupo_id) then raise exception 'ocorrencia_indisponivel' using errcode='23514'; end if;
 perform 1 from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null and chamado_id is null and ocorrencia_preventiva_id is null for share;
 if not found then raise exception 'os_indisponivel' using errcode='23514'; end if;
 insert into pcm.sso_decisoes_intencao_grupo(request_id,intencao_id,cliente_id,os_id,motivo,ator_id,payload) values(p_request_id,p_intencao_id,p_cliente_id,p_os_id,v_motivo,v_ator,v_payload);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'calendario.reconciliacao_intencao_grupo_decidida','ordens_servico',p_os_id,jsonb_build_object('requestId',p_request_id,'intencaoId',p_intencao_id,'motivo',v_motivo));
 return jsonb_build_object('requestId',p_request_id,'decisaoRegistrada',true,'vinculoCriado',false,'osAlterada',false);
end; $$;
revoke all on function pcm.sso_decidir_vinculo_intencao_grupo(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
create function pcm.sso_guardar_vinculo_intencao_grupo() returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- Serializa com 0830: a ocorrência é a mesma linha que a intenção trava.
 perform 1 from pcm.sso_ocorrencias_grupo where id=new.ocorrencia_grupo_id and cliente_id=new.cliente_id for update;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='23514'; end if;
 if exists(select 1 from pcm.sso_intencoes_os_grupo i where i.ocorrencia_grupo_id=new.ocorrencia_grupo_id and not exists(select 1 from pcm.sso_decisoes_intencao_grupo d where d.intencao_id=i.id and d.cliente_id=new.cliente_id and d.os_id=new.os_id)) then raise exception 'reconciliacao_intencao_necessaria' using errcode='55000'; end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_vinculo_intencao_grupo() from public,anon,authenticated,service_role;
create trigger sso_guardar_vinculo_intencao_grupo before insert on pcm.sso_vinculos_os_grupo for each row execute function pcm.sso_guardar_vinculo_intencao_grupo();
