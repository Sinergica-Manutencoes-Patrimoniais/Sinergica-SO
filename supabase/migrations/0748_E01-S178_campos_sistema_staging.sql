-- ADR-0523: staging explícito, nenhuma aplicação ao cadastro oficial.
create table pcm.sso_campos_sistema_staging_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_campos_sistema_staging_gate(id,habilitado) values(true,false);
create table pcm.sso_edicoes_sistema_staging(id uuid primary key default gen_random_uuid(),request_id uuid not null unique,lote_id uuid not null,linha_chave text not null,revisao_lote integer not null,campos jsonb not null,motivo text not null check(length(btrim(motivo)) between 1 and 2000),ator_id uuid not null references auth.users(id),payload jsonb not null,criado_em timestamptz not null default now(),foreign key(lote_id,linha_chave) references pcm.sso_levantamento_linhas(lote_id,chave),unique(lote_id,revisao_lote));
alter table pcm.sso_campos_sistema_staging_gate enable row level security;alter table pcm.sso_campos_sistema_staging_gate force row level security;
alter table pcm.sso_edicoes_sistema_staging enable row level security;alter table pcm.sso_edicoes_sistema_staging force row level security;
revoke all on pcm.sso_campos_sistema_staging_gate,pcm.sso_edicoes_sistema_staging from public,anon,authenticated,service_role;
create trigger sso_edicoes_sistema_staging_imutaveis before update or delete on pcm.sso_edicoes_sistema_staging for each row execute function pcm.sso_proteger_conferencia_levantamento();
create function pcm.sso_editar_campos_sistema_staging(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_campos jsonb,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_linha pcm.sso_levantamento_linhas%rowtype;v_ant pcm.sso_edicoes_sistema_staging%rowtype;v_payload jsonb;v_ciclo integer;v_area uuid;v_local uuid;
begin
 if not coalesce((select habilitado from pcm.sso_campos_sistema_staging_gate where id),false) then raise exception 'edicao_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1 or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or jsonb_typeof(p_campos) is distinct from 'object' or p_campos='{}'::jsonb or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if exists(select 1 from jsonb_each(p_campos) x where x.key not in ('tipo','descricao','categoriaId','areaId','localId') or jsonb_typeof(x.value) not in ('string','null') or (x.key in ('tipo','descricao') and length(coalesce(x.value #>> '{}',''))>4000) or (x.key in ('categoriaId','areaId','localId') and jsonb_typeof(x.value)='string' and (x.value #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) then raise exception 'campos_invalidos' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('loteId',p_lote_id,'linhaChave',p_chave,'expectedRevision',p_expected_revision,'campos',p_campos,'motivo',btrim(p_motivo));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sistema-staging:'||p_request_id::text,0));
 select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_edicoes_sistema_staging where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from auth.uid() or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return jsonb_build_object('requestId',p_request_id,'loteId',p_lote_id,'linhaChave',p_chave,'revision',v_ant.revisao_lote,'oficialAlterado',false); end if;
 if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 select * into v_linha from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave;
 if not found or v_linha.tipo<>'sistema' or exists(select 1 from pcm.sso_levantamento_incorporacoes where lote_id=p_lote_id) or exists(select 1 from pcm.sso_atualizacoes_localizacao where lote_id=p_lote_id) then raise exception 'linha_ou_lote_indisponivel' using errcode='23514'; end if;
 select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),1) into v_ciclo;
 if exists(select 1 from pcm.sso_conferencia_linhas where lote_id=p_lote_id and linha_chave=p_chave and ciclo=v_ciclo) or exists(select 1 from pcm.sso_conferencia_lotes where lote_id=p_lote_id and revisao>coalesce((select ultima_reabertura_revision from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),0)) then raise exception 'reabrir_conferencia_obrigatorio' using errcode='23514'; end if;
 if jsonb_typeof(p_campos->'categoriaId')='string' and not exists(select 1 from pcm.equipamento_categorias where id=(p_campos->>'categoriaId')::uuid and deleted_at is null) then raise exception 'categoria_indisponivel' using errcode='23514'; end if;
 if jsonb_typeof(p_campos->'areaId')='string' then select a.id into v_area from pcm.areas a where a.id=(p_campos->>'areaId')::uuid and a.cliente_id=v_lote.cliente_id and a.ativo and a.deleted_at is null for key share; if v_area is null then raise exception 'area_indisponivel' using errcode='23514'; end if; end if;
 if jsonb_typeof(p_campos->'localId')='string' then select l.id into v_local from pcm.locais l join pcm.areas a on a.id=l.area_id where l.id=(p_campos->>'localId')::uuid and a.cliente_id=v_lote.cliente_id and a.ativo and a.deleted_at is null and l.ativo and l.deleted_at is null and (v_area is null or l.area_id=v_area) for key share of l,a; if v_local is null then raise exception 'local_indisponivel_ou_area_divergente' using errcode='23514'; end if; end if;
 update pcm.sso_levantamentos set revisao=revisao+1 where id=p_lote_id returning * into v_lote;
 insert into pcm.sso_edicoes_sistema_staging(request_id,lote_id,linha_chave,revisao_lote,campos,motivo,ator_id,payload) values(p_request_id,p_lote_id,p_chave,v_lote.revisao,p_campos,btrim(p_motivo),auth.uid(),v_payload);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'levantamento.campos_sistema_preparados','sso_levantamentos',p_lote_id,v_payload||jsonb_build_object('clienteId',v_lote.cliente_id,'revision',v_lote.revisao,'requestId',p_request_id,'oficialAlterado',false));
 return jsonb_build_object('requestId',p_request_id,'loteId',p_lote_id,'linhaChave',p_chave,'revision',v_lote.revisao,'oficialAlterado',false);
end; $$;
revoke all on function pcm.sso_editar_campos_sistema_staging(uuid,uuid,integer,text,jsonb,text) from public,anon,authenticated,service_role;
create function pcm.sso_bloquear_sistema_staging_nao_integrado() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.tipo='sistema' and exists(select 1 from pcm.sso_edicoes_sistema_staging e where e.lote_id=new.lote_id and e.linha_chave=new.linha_chave) then raise exception 'campos_sistema_ainda_nao_integrados' using errcode='55000'; end if;
 return new;
end; $$;
revoke all on function pcm.sso_bloquear_sistema_staging_nao_integrado() from public,anon,authenticated,service_role;
create trigger sso_bloquear_sistema_staging_nao_integrado before insert on pcm.sso_levantamento_incorporacoes for each row execute function pcm.sso_bloquear_sistema_staging_nao_integrado();
