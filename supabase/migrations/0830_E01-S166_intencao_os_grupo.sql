-- ADR-0605: intenção isolada; não cria OS nem trabalho externo.
create table pcm.sso_intencao_os_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_intencao_os_grupo_gate enable row level security;
alter table pcm.sso_intencao_os_grupo_gate force row level security;
revoke all on pcm.sso_intencao_os_grupo_gate from public,anon,authenticated,service_role;
insert into pcm.sso_intencao_os_grupo_gate(id,habilitado) values(true,false);
create table pcm.sso_intencoes_os_grupo (
 id uuid primary key,request_id uuid not null unique,cliente_id uuid not null references pcm.clientes(id),
 ocorrencia_grupo_id uuid not null unique references pcm.sso_ocorrencias_grupo(id),rotina_snapshot jsonb not null,
 quantidade_snapshot bigint not null,grupo_revisao integer not null,titulo text not null,motivo text not null,
 ator_id uuid not null references auth.users(id),payload jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_intencoes_os_grupo enable row level security;
alter table pcm.sso_intencoes_os_grupo force row level security;
revoke all on pcm.sso_intencoes_os_grupo from public,anon,authenticated,service_role;
create trigger sso_intencao_os_grupo_imutavel before update or delete on pcm.sso_intencoes_os_grupo for each row execute function pcm.sso_proteger_conferencia_levantamento();
create function pcm.sso_preparar_intencao_os_grupo(p_request_id uuid,p_cliente_id uuid,p_ocorrencia_id uuid,p_titulo text,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_ant pcm.sso_intencoes_os_grupo%rowtype;v_ocorrencia pcm.sso_ocorrencias_grupo%rowtype;v_snapshot jsonb;v_rotina jsonb;v_n integer;v_id uuid;v_payload jsonb;v_titulo text:=nullif(btrim(p_titulo),'');v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if not coalesce((select habilitado from pcm.sso_intencao_os_grupo_gate where id),false) then raise exception 'intencao_os_grupo_bloqueada' using errcode='55000'; end if;
 if v_ator is null or p_request_id is null or p_cliente_id is null or p_ocorrencia_id is null or v_titulo is null or length(v_titulo)>200 or v_motivo is null or length(v_motivo)>2000 then raise exception 'pedido_invalido' using errcode='22023'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'ocorrenciaId',p_ocorrencia_id,'titulo',v_titulo,'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('intencao-os-grupo:'||p_request_id::text,0));
 select * into v_ant from pcm.sso_intencoes_os_grupo where request_id=p_request_id;
 if found then
   if v_ant.ator_id is distinct from v_ator or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
   return jsonb_build_object('requestId',p_request_id,'intencaoId',v_ant.id,'osCriada',false,'tarefaCriada',false,'execucaoAutorizada',false);
 end if;
 select * into v_ocorrencia from pcm.sso_ocorrencias_grupo where id=p_ocorrencia_id and cliente_id=p_cliente_id for update;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='42501'; end if;
 if exists(select 1 from pcm.sso_vinculos_os_grupo where ocorrencia_grupo_id=p_ocorrencia_id) then raise exception 'ocorrencia_ja_possui_os_declarada' using errcode='23514'; end if;
 select snapshot into v_snapshot from pcm.plano_versoes where id=v_ocorrencia.versao_id and plano_id=v_ocorrencia.plano_id and estado='aprovado' for share;
 if not found or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514'; end if;
 select count(*),min(item::text)::jsonb into v_n,v_rotina from jsonb_array_elements(v_snapshot->'rotinas') x(item) where item->>'id'=v_ocorrencia.rotina_id::text and item->>'alvo_tipo'='grupo' and item->>'grupo_id'=v_ocorrencia.grupo_id::text;
 if v_n<>1 then raise exception 'rotina_historica_incompativel' using errcode='23514'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_id:=gen_random_uuid();
 insert into pcm.sso_intencoes_os_grupo(id,request_id,cliente_id,ocorrencia_grupo_id,rotina_snapshot,quantidade_snapshot,grupo_revisao,titulo,motivo,ator_id,payload) values(v_id,p_request_id,p_cliente_id,p_ocorrencia_id,v_rotina,v_ocorrencia.quantidade_snapshot,v_ocorrencia.grupo_revisao,v_titulo,v_motivo,v_ator,v_payload);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'calendario.intencao_os_grupo_preparada','planos_manutencao',v_ocorrencia.plano_id,jsonb_build_object('requestId',p_request_id,'intencaoId',v_id,'ocorrenciaGrupoId',p_ocorrencia_id));
 return jsonb_build_object('requestId',p_request_id,'intencaoId',v_id,'osCriada',false,'tarefaCriada',false,'execucaoAutorizada',false);
end; $$;
revoke all on function pcm.sso_preparar_intencao_os_grupo(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
