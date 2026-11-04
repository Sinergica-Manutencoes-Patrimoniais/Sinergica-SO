-- ADR-0598: declaração humana aditiva; não integra execução nem modifica OS.
create table pcm.sso_vinculo_os_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_vinculo_os_grupo_gate enable row level security;
alter table pcm.sso_vinculo_os_grupo_gate force row level security;
revoke all on pcm.sso_vinculo_os_grupo_gate from public,anon,authenticated,service_role;
insert into pcm.sso_vinculo_os_grupo_gate(id,habilitado) values(true,false);
create table pcm.sso_vinculos_os_grupo (
 request_id uuid primary key, cliente_id uuid not null references pcm.clientes(id),
 ocorrencia_grupo_id uuid not null unique references pcm.sso_ocorrencias_grupo(id),
 os_id uuid not null unique references pcm.ordens_servico(id), motivo text not null,
 ator_id uuid not null references auth.users(id), payload jsonb not null, criado_em timestamptz not null default now()
);
alter table pcm.sso_vinculos_os_grupo enable row level security;
alter table pcm.sso_vinculos_os_grupo force row level security;
revoke all on pcm.sso_vinculos_os_grupo from public,anon,authenticated,service_role;
create trigger sso_vinculo_os_grupo_imutavel before update or delete on pcm.sso_vinculos_os_grupo for each row execute function pcm.sso_proteger_conferencia_levantamento();
create function pcm.sso_declarar_vinculo_os_grupo(p_request_id uuid,p_cliente_id uuid,p_ocorrencia_id uuid,p_os_id uuid,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_ant pcm.sso_vinculos_os_grupo%rowtype;v_ocorrencia pcm.sso_ocorrencias_grupo%rowtype;v_os pcm.ordens_servico%rowtype;v_payload jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if not coalesce((select habilitado from pcm.sso_vinculo_os_grupo_gate where id),false) then raise exception 'vinculo_os_grupo_bloqueado' using errcode='55000'; end if;
 if v_ator is null or p_request_id is null or p_cliente_id is null or p_ocorrencia_id is null or p_os_id is null or v_motivo is null or length(v_motivo)>2000 then raise exception 'pedido_invalido' using errcode='22023'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'ocorrenciaId',p_ocorrencia_id,'osId',p_os_id,'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('vinculo-os-grupo:'||p_request_id::text,0));
 select * into v_ant from pcm.sso_vinculos_os_grupo where request_id=p_request_id;
 if found then
   if v_ant.ator_id is distinct from v_ator or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
   return jsonb_build_object('requestId',p_request_id,'vinculoDeclarado',true,'execucaoComprovada',false,'osAlterada',false,'tarefaCriada',false);
 end if;
 select * into v_ocorrencia from pcm.sso_ocorrencias_grupo where id=p_ocorrencia_id and cliente_id=p_cliente_id for share;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='42501'; end if;
 select * into v_os from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null for share;
 if not found then raise exception 'os_indisponivel' using errcode='42501'; end if;
 if v_os.ocorrencia_preventiva_id is not null or v_os.chamado_id is not null then raise exception 'os_origem_existente_exige_reconciliacao' using errcode='23514'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 insert into pcm.sso_vinculos_os_grupo(request_id,cliente_id,ocorrencia_grupo_id,os_id,motivo,ator_id,payload) values(p_request_id,p_cliente_id,p_ocorrencia_id,p_os_id,v_motivo,v_ator,v_payload);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'calendario.vinculo_os_grupo_declarado','ordens_servico',p_os_id,jsonb_build_object('requestId',p_request_id,'ocorrenciaGrupoId',p_ocorrencia_id,'motivo',v_motivo));
 return jsonb_build_object('requestId',p_request_id,'vinculoDeclarado',true,'execucaoComprovada',false,'osAlterada',false,'tarefaCriada',false);
end; $$;
revoke all on function pcm.sso_declarar_vinculo_os_grupo(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
