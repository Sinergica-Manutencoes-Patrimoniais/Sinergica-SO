-- ADR-0537: dados explícitos e conferência, sem aplicação oficial.
create table pcm.sso_campos_componente_staging_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_campos_componente_staging_gate(id,habilitado) values(true,false);
create table pcm.sso_edicoes_componente_staging(id uuid primary key default gen_random_uuid(),request_id uuid not null unique,lote_id uuid not null,linha_chave text not null,revisao_lote integer not null,campos jsonb not null,motivo text not null check(length(btrim(motivo)) between 1 and 2000),ator_id uuid not null references auth.users(id),payload jsonb not null,criado_em timestamptz not null default now(),foreign key(lote_id,linha_chave) references pcm.sso_levantamento_linhas(lote_id,chave),unique(lote_id,revisao_lote));
create table pcm.sso_conferencias_campos_componente(id uuid primary key default gen_random_uuid(),request_id uuid not null unique,lote_id uuid not null,linha_chave text not null,revisao_lote integer not null,ciclo integer not null,campos jsonb not null,motivo text not null check(length(btrim(motivo)) between 1 and 2000),ator_id uuid not null references auth.users(id),payload jsonb not null,criado_em timestamptz not null default now(),foreign key(lote_id,linha_chave) references pcm.sso_levantamento_linhas(lote_id,chave));
alter table pcm.sso_campos_componente_staging_gate enable row level security;alter table pcm.sso_campos_componente_staging_gate force row level security;
alter table pcm.sso_edicoes_componente_staging enable row level security;alter table pcm.sso_edicoes_componente_staging force row level security;
alter table pcm.sso_conferencias_campos_componente enable row level security;alter table pcm.sso_conferencias_campos_componente force row level security;
revoke all on pcm.sso_campos_componente_staging_gate,pcm.sso_edicoes_componente_staging,pcm.sso_conferencias_campos_componente from public,anon,authenticated,service_role;
create trigger sso_edicoes_componente_staging_imutaveis before update or delete on pcm.sso_edicoes_componente_staging for each row execute function pcm.sso_proteger_conferencia_levantamento();
create trigger sso_conferencias_campos_componente_imutaveis before update or delete on pcm.sso_conferencias_campos_componente for each row execute function pcm.sso_proteger_conferencia_levantamento();
create function pcm.sso_consultar_campos_componente_staging(p_lote_id uuid,p_chave text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_campos jsonb:='{}'::jsonb;v_e record;v_ciclo integer;v_conferida boolean;
begin
 if not coalesce((select habilitado from pcm.sso_campos_componente_staging_gate where id),false) then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_lote_id is null or p_chave is null or length(btrim(p_chave)) not between 1 and 200 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 select * into v_lote from pcm.sso_levantamentos where id=p_lote_id;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true or not exists(select 1 from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave and tipo in ('equipamento','componente')) then raise exception 'sem_acesso' using errcode='42501'; end if;
 for v_e in select campos from pcm.sso_edicoes_componente_staging where lote_id=p_lote_id and linha_chave=p_chave order by revisao_lote loop v_campos:=v_campos||v_e.campos; end loop;
 select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),1) into v_ciclo;
 select exists(select 1 from pcm.sso_conferencia_linhas where lote_id=p_lote_id and linha_chave=p_chave and ciclo=v_ciclo) or exists(select 1 from pcm.sso_conferencia_lotes where lote_id=p_lote_id and revisao>coalesce((select ultima_reabertura_revision from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),0)) into v_conferida;
 return jsonb_build_object('loteId',p_lote_id,'linhaChave',p_chave,'revision',v_lote.revisao,'campos',v_campos,'conferenciaVigente',v_conferida,'camposConferidos',exists(select 1 from pcm.sso_conferencias_campos_componente c where c.lote_id=p_lote_id and c.linha_chave=p_chave and c.ciclo=v_ciclo and c.campos=v_campos and c.revisao_lote>coalesce((select max(e.revisao_lote) from pcm.sso_edicoes_componente_staging e where e.lote_id=p_lote_id and e.linha_chave=p_chave),0)),'oficialAlterado',false,'integracaoConcluida',false);
end; $$;
revoke all on function pcm.sso_consultar_campos_componente_staging(uuid,text) from public,anon,authenticated,service_role;
create function pcm.sso_historico_campos_componente_staging(p_lote_id uuid,p_chave text,p_apos integer,p_limite integer) returns table(revisao_lote integer,campos jsonb,motivo text,ator_id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
declare v_contexto jsonb;
begin
 if p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<0) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 v_contexto:=pcm.sso_consultar_campos_componente_staging(p_lote_id,p_chave);
 return query select e.revisao_lote,e.campos,e.motivo,e.ator_id,e.criado_em from pcm.sso_edicoes_componente_staging e where e.lote_id=p_lote_id and e.linha_chave=p_chave and (p_apos is null or e.revisao_lote>p_apos) order by e.revisao_lote limit p_limite;
end; $$;
revoke all on function pcm.sso_historico_campos_componente_staging(uuid,text,integer,integer) from public,anon,authenticated,service_role;
create function pcm.sso_editar_campos_componente_staging(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_campos jsonb,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_linha pcm.sso_levantamento_linhas%rowtype;v_ant pcm.sso_edicoes_componente_staging%rowtype;v_contexto jsonb;v_payload jsonb;v_area uuid;v_local uuid;
begin
 if not coalesce((select habilitado from pcm.sso_campos_componente_staging_gate where id),false) then raise exception 'edicao_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1 or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or jsonb_typeof(p_campos) is distinct from 'object' or p_campos='{}'::jsonb or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if exists(select 1 from jsonb_each(p_campos) x where x.key not in ('observacoes','categoriaId','areaId','localId','parentItemId') or jsonb_typeof(x.value) not in ('string','null') or (x.key='observacoes' and length(coalesce(x.value #>> '{}',''))>4000) or (x.key<>'observacoes' and jsonb_typeof(x.value)='string' and (x.value #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) then raise exception 'campos_invalidos' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('loteId',p_lote_id,'linhaChave',p_chave,'expectedRevision',p_expected_revision,'campos',p_campos,'motivo',btrim(p_motivo));perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('componente-staging:'||p_request_id::text,0));
 select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_edicoes_componente_staging where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from auth.uid() or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return jsonb_build_object('requestId',p_request_id,'loteId',p_lote_id,'linhaChave',p_chave,'revision',v_ant.revisao_lote,'oficialAlterado',false); end if;
 if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 select * into v_linha from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave;
 if not found or v_linha.tipo not in ('equipamento','componente') or exists(select 1 from pcm.sso_levantamento_incorporacoes where lote_id=p_lote_id) or exists(select 1 from pcm.sso_atualizacoes_localizacao where lote_id=p_lote_id) then raise exception 'linha_ou_lote_indisponivel' using errcode='23514'; end if;
 v_contexto:=pcm.sso_consultar_campos_componente_staging(p_lote_id,p_chave);if (v_contexto->>'conferenciaVigente')::boolean then raise exception 'reabrir_conferencia_obrigatorio' using errcode='23514'; end if;
 if v_linha.tipo='equipamento' and jsonb_typeof(p_campos->'parentItemId')='string' then raise exception 'equipamento_nao_admite_pai' using errcode='23514'; end if;
 if jsonb_typeof(p_campos->'categoriaId')='string' and not exists(select 1 from pcm.equipamento_categorias where id=(p_campos->>'categoriaId')::uuid and deleted_at is null) then raise exception 'categoria_indisponivel' using errcode='23514'; end if;
 if jsonb_typeof(p_campos->'areaId')='string' then select a.id into v_area from pcm.areas a where a.id=(p_campos->>'areaId')::uuid and a.cliente_id=v_lote.cliente_id and a.ativo and a.deleted_at is null for key share; if v_area is null then raise exception 'area_indisponivel' using errcode='23514'; end if; end if;
 if jsonb_typeof(p_campos->'localId')='string' then select l.id into v_local from pcm.locais l join pcm.areas a on a.id=l.area_id where l.id=(p_campos->>'localId')::uuid and a.cliente_id=v_lote.cliente_id and a.ativo and a.deleted_at is null and l.ativo and l.deleted_at is null and (v_area is null or l.area_id=v_area) for key share of l,a; if v_local is null then raise exception 'local_indisponivel_ou_area_divergente' using errcode='23514'; end if; end if;
 if jsonb_typeof(p_campos->'parentItemId')='string' and not exists(select 1 from pcm.equipamentos e where e.id=(p_campos->>'parentItemId')::uuid and e.client_id=v_lote.cliente_id and e.tipo='equipamento' and e.ativo and e.deleted_at is null and (v_local is null or e.local_id=v_local)) then raise exception 'equipamento_pai_indisponivel' using errcode='23514'; end if;
 update pcm.sso_levantamentos set revisao=revisao+1 where id=p_lote_id returning * into v_lote;
 insert into pcm.sso_edicoes_componente_staging(request_id,lote_id,linha_chave,revisao_lote,campos,motivo,ator_id,payload) values(p_request_id,p_lote_id,p_chave,v_lote.revisao,p_campos,btrim(p_motivo),auth.uid(),v_payload);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'levantamento.campos_componente_preparados','sso_levantamentos',p_lote_id,v_payload||jsonb_build_object('clienteId',v_lote.cliente_id,'revision',v_lote.revisao,'requestId',p_request_id,'oficialAlterado',false));
 return jsonb_build_object('requestId',p_request_id,'loteId',p_lote_id,'linhaChave',p_chave,'revision',v_lote.revisao,'oficialAlterado',false);
end; $$;
revoke all on function pcm.sso_editar_campos_componente_staging(uuid,uuid,integer,text,jsonb,text) from public,anon,authenticated,service_role;
create function pcm.sso_conferir_campos_componente_staging(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_retrato jsonb,p_confirma boolean,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_ant pcm.sso_conferencias_campos_componente%rowtype;v_contexto jsonb;v_ciclo integer;v_payload jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_campos_componente_staging_gate where id),false) then raise exception 'conferencia_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1 or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or jsonb_typeof(p_retrato) is distinct from 'object' or p_retrato='{}'::jsonb or p_confirma is not true or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('loteId',p_lote_id,'linhaChave',p_chave,'expectedRevision',p_expected_revision,'retrato',p_retrato,'confirma',true,'motivo',btrim(p_motivo));perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('conferir-componente-staging:'||p_request_id::text,0));
 select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_conferencias_campos_componente where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from auth.uid() or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return jsonb_build_object('requestId',p_request_id,'loteId',p_lote_id,'linhaChave',p_chave,'revision',v_ant.revisao_lote,'oficialAlterado',false); end if;
 if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 v_contexto:=pcm.sso_consultar_campos_componente_staging(p_lote_id,p_chave);if (v_contexto->>'conferenciaVigente')::boolean or v_contexto->'campos' is distinct from p_retrato then raise exception 'conferencia_vigente_ou_retrato_divergente' using errcode='40001'; end if;
 select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),1) into v_ciclo;
 update pcm.sso_levantamentos set revisao=revisao+1 where id=p_lote_id returning * into v_lote;
 insert into pcm.sso_conferencias_campos_componente(request_id,lote_id,linha_chave,revisao_lote,ciclo,campos,motivo,ator_id,payload) values(p_request_id,p_lote_id,p_chave,v_lote.revisao,v_ciclo,p_retrato,btrim(p_motivo),auth.uid(),v_payload);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'levantamento.campos_componente_conferidos','sso_levantamentos',p_lote_id,v_payload||jsonb_build_object('clienteId',v_lote.cliente_id,'revision',v_lote.revisao,'requestId',p_request_id,'oficialAlterado',false));
 return jsonb_build_object('requestId',p_request_id,'loteId',p_lote_id,'linhaChave',p_chave,'revision',v_lote.revisao,'oficialAlterado',false);
end; $$;
revoke all on function pcm.sso_conferir_campos_componente_staging(uuid,uuid,integer,text,jsonb,boolean,text) from public,anon,authenticated,service_role;
create function pcm.sso_bloquear_componente_staging_nao_integrado() returns trigger language plpgsql security definer set search_path='' as $$ begin if new.tipo in ('equipamento','componente') and exists(select 1 from pcm.sso_edicoes_componente_staging e where e.lote_id=new.lote_id and e.linha_chave=new.linha_chave) then raise exception 'campos_componente_ainda_nao_integrados' using errcode='55000'; end if;return new;end; $$;
revoke all on function pcm.sso_bloquear_componente_staging_nao_integrado() from public,anon,authenticated,service_role;
create trigger sso_bloquear_componente_staging_nao_integrado before insert on pcm.sso_levantamento_incorporacoes for each row execute function pcm.sso_bloquear_componente_staging_nao_integrado();
