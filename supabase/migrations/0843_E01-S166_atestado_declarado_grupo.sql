-- ADR-0618: declaração PCM; não autentica evidência nem encerra ocorrência.
create table pcm.sso_atestado_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_atestado_grupo_gate enable row level security;
alter table pcm.sso_atestado_grupo_gate force row level security;
revoke all on pcm.sso_atestado_grupo_gate from public,anon,authenticated,service_role;
insert into pcm.sso_atestado_grupo_gate(id,habilitado) values(true,false);
create table pcm.sso_atestados_declarados_grupo (
 request_id uuid primary key,cliente_id uuid not null references pcm.clientes(id),ocorrencia_id uuid not null references pcm.sso_ocorrencias_grupo(id),
 os_id uuid not null references pcm.ordens_servico(id),intencao_id uuid not null references pcm.sso_intencoes_os_grupo(id),revisao integer not null check(revisao>0),
 declaracao text not null,referencia_evidencia text not null,rotina_snapshot jsonb not null,quantidade_snapshot bigint not null,grupo_revisao integer not null,
 ator_id uuid not null references auth.users(id),payload jsonb not null,criado_em timestamptz not null default now(),unique(ocorrencia_id,revisao)
);
alter table pcm.sso_atestados_declarados_grupo enable row level security;
alter table pcm.sso_atestados_declarados_grupo force row level security;
revoke all on pcm.sso_atestados_declarados_grupo from public,anon,authenticated,service_role;
create trigger sso_atestado_grupo_imutavel before update or delete on pcm.sso_atestados_declarados_grupo for each row execute function pcm.sso_proteger_conferencia_levantamento();
create function pcm.sso_declarar_atestado_grupo(p_request_id uuid,p_cliente_id uuid,p_ocorrencia_id uuid,p_expected_revision integer,p_declaracao text,p_referencia_evidencia text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_ocorrencia pcm.sso_ocorrencias_grupo%rowtype;v_intencao pcm.sso_intencoes_os_grupo%rowtype;v_ant pcm.sso_atestados_declarados_grupo%rowtype;v_os uuid;v_revisao integer;v_payload jsonb;v_declaracao text:=nullif(btrim(p_declaracao),'');v_referencia text:=nullif(btrim(p_referencia_evidencia),'');
begin
 if not coalesce((select habilitado from pcm.sso_atestado_grupo_gate where id),false) then raise exception 'atestado_grupo_bloqueado' using errcode='55000'; end if;
 if v_ator is null or p_request_id is null or p_cliente_id is null or p_ocorrencia_id is null or p_expected_revision is null or p_expected_revision<0 or v_declaracao is null or length(v_declaracao)>2000 or v_referencia is null or length(v_referencia)>1000 then raise exception 'pedido_invalido' using errcode='22023'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'ocorrenciaId',p_ocorrencia_id,'expectedRevision',p_expected_revision,'declaracao',v_declaracao,'referenciaEvidencia',v_referencia);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('atestado-grupo:'||p_request_id::text,0));
 select * into v_ant from pcm.sso_atestados_declarados_grupo where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_ator or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return jsonb_build_object('requestId',p_request_id,'revisao',v_ant.revisao,'evidenciaAutenticada',false,'ocorrenciaEncerrada',false); end if;
 select * into v_ocorrencia from pcm.sso_ocorrencias_grupo where id=p_ocorrencia_id and cliente_id=p_cliente_id for update;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='42501'; end if;
 select * into v_intencao from pcm.sso_intencoes_os_grupo where ocorrencia_grupo_id=p_ocorrencia_id and cliente_id=p_cliente_id;
 if not found or v_intencao.grupo_revisao is distinct from v_ocorrencia.grupo_revisao or v_intencao.quantidade_snapshot is distinct from v_ocorrencia.quantidade_snapshot then raise exception 'snapshot_indisponivel' using errcode='23514'; end if;
 select v.os_id into v_os from pcm.sso_vinculos_os_grupo v join pcm.ordens_servico os on os.id=v.os_id and os.client_id=v.cliente_id and os.deleted_at is null where v.ocorrencia_grupo_id=p_ocorrencia_id and v.cliente_id=p_cliente_id;
 if v_os is null or not exists(select 1 from pcm.sso_decisoes_intencao_grupo d where d.intencao_id=v_intencao.id and d.cliente_id=p_cliente_id and d.os_id=v_os) then raise exception 'vinculo_ou_decisao_indisponivel' using errcode='23514'; end if;
 select coalesce(max(revisao),0) into v_revisao from pcm.sso_atestados_declarados_grupo where ocorrencia_id=p_ocorrencia_id;
 if v_revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 insert into pcm.sso_atestados_declarados_grupo(request_id,cliente_id,ocorrencia_id,os_id,intencao_id,revisao,declaracao,referencia_evidencia,rotina_snapshot,quantidade_snapshot,grupo_revisao,ator_id,payload) values(p_request_id,p_cliente_id,p_ocorrencia_id,v_os,v_intencao.id,v_revisao+1,v_declaracao,v_referencia,v_intencao.rotina_snapshot,v_intencao.quantidade_snapshot,v_intencao.grupo_revisao,v_ator,v_payload);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'execucao.atestado_grupo_declarado','ordens_servico',v_os,jsonb_build_object('requestId',p_request_id,'ocorrenciaId',p_ocorrencia_id,'revisao',v_revisao+1));
 return jsonb_build_object('requestId',p_request_id,'revisao',v_revisao+1,'evidenciaAutenticada',false,'ocorrenciaEncerrada',false);
end; $$;
revoke all on function pcm.sso_declarar_atestado_grupo(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
