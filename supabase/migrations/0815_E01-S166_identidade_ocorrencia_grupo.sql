-- ADR-0590: identidade aditiva de Grupo, sem entrada em fila ou criação de OS.
create table pcm.sso_ocorrencia_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_ocorrencia_grupo_gate enable row level security;
alter table pcm.sso_ocorrencia_grupo_gate force row level security;
revoke all on pcm.sso_ocorrencia_grupo_gate from public,anon,authenticated,service_role;
insert into pcm.sso_ocorrencia_grupo_gate(id,habilitado) values(true,false);
create table pcm.sso_ocorrencias_grupo (
 id uuid primary key, request_id uuid not null unique, cliente_id uuid not null references pcm.clientes(id),
 plano_id uuid not null references pcm.planos_manutencao(id), versao_id uuid not null references pcm.plano_versoes(id),
 rotina_id uuid not null references pcm.rotinas_manutencao(id), grupo_id uuid not null references pcm.grupos_quantitativos(id),
 calendario_preparado_id uuid unique references pcm.ocorrencias_rotina_preparadas(id),
 visita_preparada_id uuid unique references pcm.ocorrencias_visita_preparadas(id),
 vencimento_original date not null, grupo_revisao integer not null, quantidade_snapshot bigint not null,
 ator_id uuid not null references auth.users(id), payload jsonb not null, criado_em timestamptz not null default now(),
 check ((calendario_preparado_id is null) <> (visita_preparada_id is null))
);
alter table pcm.sso_ocorrencias_grupo enable row level security;
alter table pcm.sso_ocorrencias_grupo force row level security;
revoke all on pcm.sso_ocorrencias_grupo from public,anon,authenticated,service_role;
create trigger sso_ocorrencia_grupo_imutavel before update or delete on pcm.sso_ocorrencias_grupo for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_registrar_ocorrencia_grupo(p_request_id uuid,p_cliente_id uuid,p_tipo text,p_preparada_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_ant pcm.sso_ocorrencias_grupo%rowtype;v_grupo pcm.grupos_quantitativos%rowtype;
 v_plano uuid;v_versao uuid;v_rotina uuid;v_alvo uuid;v_data date;v_id uuid;v_payload jsonb;v_snapshot jsonb;v_n integer;
begin
 if not coalesce((select habilitado from pcm.sso_ocorrencia_grupo_gate where id),false) then raise exception 'ocorrencia_grupo_bloqueada' using errcode='55000'; end if;
 if v_ator is null or p_request_id is null or p_cliente_id is null or p_preparada_id is null or p_tipo is null or p_tipo not in ('calendario','visita') then raise exception 'pedido_invalido' using errcode='22023'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'tipo',p_tipo,'preparadaId',p_preparada_id);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ocorrencia-grupo:'||p_request_id::text,0));
 select * into v_ant from pcm.sso_ocorrencias_grupo where request_id=p_request_id;
 if found then
   if v_ant.ator_id is distinct from v_ator or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
   return jsonb_build_object('ocorrenciaGrupoId',v_ant.id,'requestId',p_request_id,'filaIntegrada',false,'osCriada',false);
 end if;
 if p_tipo='calendario' then
   select o.plano_id,o.versao_id,o.rotina_id,o.alvo_id,o.vencimento_original into v_plano,v_versao,v_rotina,v_alvo,v_data from pcm.ocorrencias_rotina_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente_id where o.id=p_preparada_id and o.alvo_tipo='grupo' for share of o,p;
 else
   select o.plano_id,o.versao_id,o.rotina_id,o.alvo_id,o.vencimento_original into v_plano,v_versao,v_rotina,v_alvo,v_data from pcm.ocorrencias_visita_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente_id where o.id=p_preparada_id and o.alvo_tipo='grupo' for share of o,p;
 end if;
 if not found then raise exception 'origem_indisponivel' using errcode='23514'; end if;
 select * into v_grupo from pcm.grupos_quantitativos where id=v_alvo and cliente_id=p_cliente_id and ativo and deleted_at is null for share;
 if not found then raise exception 'grupo_indisponivel' using errcode='23514'; end if;
 select snapshot into v_snapshot from pcm.plano_versoes where id=v_versao and plano_id=v_plano and estado='aprovado' for share;
 if not found or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514'; end if;
 select count(*) into v_n from jsonb_array_elements(v_snapshot->'rotinas') x(item) where item->>'id'=v_rotina::text and item->>'alvo_tipo'='grupo' and item->>'grupo_id'=v_alvo::text and item->>'modo'=p_tipo;
 if v_n<>1 then raise exception 'rotina_historica_incompativel' using errcode='23514'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_id:=gen_random_uuid();
 insert into pcm.sso_ocorrencias_grupo(id,request_id,cliente_id,plano_id,versao_id,rotina_id,grupo_id,calendario_preparado_id,visita_preparada_id,vencimento_original,grupo_revisao,quantidade_snapshot,ator_id,payload)
 values(v_id,p_request_id,p_cliente_id,v_plano,v_versao,v_rotina,v_alvo,case when p_tipo='calendario' then p_preparada_id end,case when p_tipo='visita' then p_preparada_id end,v_data,v_grupo.revisao,v_grupo.quantidade,v_ator,v_payload);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'calendario.ocorrencia_grupo_registrada','planos_manutencao',v_plano,jsonb_build_object('ocorrenciaGrupoId',v_id,'requestId',p_request_id));
 return jsonb_build_object('ocorrenciaGrupoId',v_id,'requestId',p_request_id,'filaIntegrada',false,'osCriada',false);
end; $$;
revoke all on function pcm.sso_registrar_ocorrencia_grupo(uuid,uuid,text,uuid) from public,anon,authenticated,service_role;
