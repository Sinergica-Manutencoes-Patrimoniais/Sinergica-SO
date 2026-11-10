create table pcm.sso_consulta_campos_sistema_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_consulta_campos_sistema_gate(id,habilitado) values(true,false);
alter table pcm.sso_consulta_campos_sistema_gate enable row level security;alter table pcm.sso_consulta_campos_sistema_gate force row level security;
revoke all on pcm.sso_consulta_campos_sistema_gate from public,anon,authenticated,service_role;
create table pcm.sso_conferencias_campos_sistema(id uuid primary key default gen_random_uuid(),request_id uuid not null unique,lote_id uuid not null,linha_chave text not null,revisao_lote integer not null,ciclo integer not null,campos jsonb not null,motivo text not null check(length(btrim(motivo)) between 1 and 2000),ator_id uuid not null references auth.users(id),payload jsonb not null,criado_em timestamptz not null default now(),foreign key(lote_id,linha_chave) references pcm.sso_levantamento_linhas(lote_id,chave));
alter table pcm.sso_conferencias_campos_sistema enable row level security;alter table pcm.sso_conferencias_campos_sistema force row level security;
revoke all on pcm.sso_conferencias_campos_sistema from public,anon,authenticated,service_role;
create trigger sso_conferencias_campos_sistema_imutaveis before update or delete on pcm.sso_conferencias_campos_sistema for each row execute function pcm.sso_proteger_conferencia_levantamento();
create function pcm.sso_consultar_campos_sistema_staging(p_lote_id uuid,p_chave text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_campos jsonb:='{}'::jsonb;v_edicao record;v_ciclo integer;v_conferida boolean;
begin
 if not coalesce((select habilitado from pcm.sso_consulta_campos_sistema_gate where id),false) or not coalesce((select habilitado from pcm.sso_campos_sistema_staging_gate where id),false) then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_lote_id is null or p_chave is null or length(btrim(p_chave)) not between 1 and 200 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 select * into v_lote from pcm.sso_levantamentos where id=p_lote_id;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true or not exists(select 1 from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave and tipo='sistema') then raise exception 'sem_acesso' using errcode='42501'; end if;
 for v_edicao in select campos from pcm.sso_edicoes_sistema_staging where lote_id=p_lote_id and linha_chave=p_chave order by revisao_lote loop v_campos:=v_campos||v_edicao.campos; end loop;
 select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),1) into v_ciclo;
 select exists(select 1 from pcm.sso_conferencia_linhas where lote_id=p_lote_id and linha_chave=p_chave and ciclo=v_ciclo) or exists(select 1 from pcm.sso_conferencia_lotes where lote_id=p_lote_id and revisao>coalesce((select ultima_reabertura_revision from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),0)) into v_conferida;
 return jsonb_build_object('loteId',p_lote_id,'linhaChave',p_chave,'revision',v_lote.revisao,'campos',v_campos,'conferenciaVigente',v_conferida,'camposConferidos',exists(select 1 from pcm.sso_conferencias_campos_sistema c where c.lote_id=p_lote_id and c.linha_chave=p_chave and c.ciclo=v_ciclo and c.campos=v_campos and c.revisao_lote>coalesce((select max(e.revisao_lote) from pcm.sso_edicoes_sistema_staging e where e.lote_id=p_lote_id and e.linha_chave=p_chave),0)),'oficialAlterado',false,'integracaoConcluida',false);
end; $$;
revoke all on function pcm.sso_consultar_campos_sistema_staging(uuid,text) from public,anon,authenticated,service_role;
create function pcm.sso_historico_campos_sistema_staging(p_lote_id uuid,p_chave text,p_apos integer,p_limite integer)
returns table(revisao_lote integer,campos jsonb,motivo text,ator_id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
declare v_contexto jsonb;
begin
 if p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<0) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 v_contexto:=pcm.sso_consultar_campos_sistema_staging(p_lote_id,p_chave);
 return query select e.revisao_lote,e.campos,e.motivo,e.ator_id,e.criado_em from pcm.sso_edicoes_sistema_staging e where e.lote_id=p_lote_id and e.linha_chave=p_chave and (p_apos is null or e.revisao_lote>p_apos) order by e.revisao_lote limit p_limite;
end; $$;
revoke all on function pcm.sso_historico_campos_sistema_staging(uuid,text,integer,integer) from public,anon,authenticated,service_role;
create function pcm.sso_conferir_campos_sistema_staging(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_retrato jsonb,p_confirma boolean,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_ant pcm.sso_conferencias_campos_sistema%rowtype;v_contexto jsonb;v_ciclo integer;v_payload jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_consulta_campos_sistema_gate where id),false) or not coalesce((select habilitado from pcm.sso_campos_sistema_staging_gate where id),false) then raise exception 'conferencia_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1 or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or jsonb_typeof(p_retrato) is distinct from 'object' or p_retrato='{}'::jsonb or p_confirma is not true or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('loteId',p_lote_id,'linhaChave',p_chave,'expectedRevision',p_expected_revision,'retrato',p_retrato,'confirma',true,'motivo',btrim(p_motivo));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('conferir-sistema-staging:'||p_request_id::text,0));
 select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_conferencias_campos_sistema where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from auth.uid() or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return jsonb_build_object('requestId',p_request_id,'loteId',p_lote_id,'linhaChave',p_chave,'revision',v_ant.revisao_lote,'oficialAlterado',false); end if;
 if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 v_contexto:=pcm.sso_consultar_campos_sistema_staging(p_lote_id,p_chave);
 if (v_contexto->>'conferenciaVigente')::boolean or v_contexto->'campos' is distinct from p_retrato then raise exception 'conferencia_vigente_ou_retrato_divergente' using errcode='40001'; end if;
 select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),1) into v_ciclo;
 update pcm.sso_levantamentos set revisao=revisao+1 where id=p_lote_id returning * into v_lote;
 insert into pcm.sso_conferencias_campos_sistema(request_id,lote_id,linha_chave,revisao_lote,ciclo,campos,motivo,ator_id,payload) values(p_request_id,p_lote_id,p_chave,v_lote.revisao,v_ciclo,p_retrato,btrim(p_motivo),auth.uid(),v_payload);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'levantamento.campos_sistema_conferidos','sso_levantamentos',p_lote_id,v_payload||jsonb_build_object('clienteId',v_lote.cliente_id,'revision',v_lote.revisao,'requestId',p_request_id,'oficialAlterado',false));
 return jsonb_build_object('requestId',p_request_id,'loteId',p_lote_id,'linhaChave',p_chave,'revision',v_lote.revisao,'oficialAlterado',false);
end; $$;
revoke all on function pcm.sso_conferir_campos_sistema_staging(uuid,uuid,integer,text,jsonb,boolean,text) from public,anon,authenticated,service_role;
