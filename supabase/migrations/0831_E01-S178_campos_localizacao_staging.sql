create table pcm.sso_campos_localizacao_staging_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_campos_localizacao_staging_gate(id,habilitado) values(true,false);
create table pcm.sso_campos_localizacao_staging(lote_id uuid not null,linha_chave text not null,revisao integer not null,campos jsonb not null,ator_id uuid not null references auth.users(id),request_id uuid not null unique,motivo text not null,criado_em timestamptz not null default now(),primary key(lote_id,linha_chave,revisao),foreign key(lote_id,linha_chave) references pcm.sso_levantamento_linhas(lote_id,chave));
alter table pcm.sso_campos_localizacao_staging_gate enable row level security;alter table pcm.sso_campos_localizacao_staging_gate force row level security;
alter table pcm.sso_campos_localizacao_staging enable row level security;alter table pcm.sso_campos_localizacao_staging force row level security;
revoke all on pcm.sso_campos_localizacao_staging_gate,pcm.sso_campos_localizacao_staging from public,anon,authenticated,service_role;
create function pcm.sso_guardar_campos_localizacao_staging() returns trigger language plpgsql set search_path='' as $$begin raise exception 'historico_imutavel' using errcode='23514';end;$$;
revoke all on function pcm.sso_guardar_campos_localizacao_staging() from public,anon,authenticated,service_role;
create trigger sso_campos_localizacao_staging_imutaveis before update or delete on pcm.sso_campos_localizacao_staging for each row execute function pcm.sso_guardar_campos_localizacao_staging();
create function pcm.sso_editar_campos_localizacao_staging(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_campos jsonb,p_motivo text,p_confirmado boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_linha pcm.sso_levantamento_linhas%rowtype;v_cmd pcm.sso_levantamento_comandos%rowtype;v_payload jsonb;v_resultado jsonb;v_ciclo integer;
begin
 if not coalesce((select habilitado from pcm.sso_campos_localizacao_staging_gate where id),false) then raise exception 'campos_desabilitados' using errcode='55000';end if;
 if auth.uid() is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1 or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or jsonb_typeof(p_campos) is distinct from 'object' or p_campos='{}'::jsonb or p_confirmado is not true or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023';end if;
 if exists(select 1 from jsonb_each(p_campos) x where x.key not in ('descricao','tipo','ordem') or (x.key in ('descricao','tipo') and jsonb_typeof(x.value) not in ('string','null')) or (x.key='ordem' and (jsonb_typeof(x.value) is distinct from 'number' or x.value::text !~ '^[0-9]{1,6}$'))) then raise exception 'campos_invalidos' using errcode='22023';end if;
 if length(coalesce(p_campos->>'descricao',''))>2000 or length(coalesce(p_campos->>'tipo',''))>200 then raise exception 'campos_invalidos' using errcode='22023';end if;
 v_payload:=jsonb_build_object('operacao','campos_localizacao_staging','loteId',p_lote_id,'expectedRevision',p_expected_revision,'chave',p_chave,'campos',p_campos,'motivo',btrim(p_motivo),'confirmado',true);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_cmd from pcm.sso_levantamento_comandos where request_id=p_request_id;
 if found then if v_cmd.ator_id is distinct from auth.uid() or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_cmd.resultado;end if;
 if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 select * into v_linha from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave;
 if not found or v_linha.tipo not in ('area','local','sublocal') or (v_linha.tipo='area' and p_campos ? 'tipo') or exists(select 1 from pcm.sso_levantamento_incorporacoes where lote_id=p_lote_id and linha_chave=p_chave) or exists(select 1 from pcm.sso_atualizacoes_localizacao where lote_id=p_lote_id and linha_chave=p_chave) or exists(select 1 from pcm.sso_levantamento_rejeicoes where lote_id=p_lote_id and linha_chave=p_chave) then raise exception 'linha_indisponivel' using errcode='23514';end if;
 select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),1) into v_ciclo;
 if exists(select 1 from pcm.sso_conferencia_linhas where lote_id=p_lote_id and linha_chave=p_chave and ciclo=v_ciclo) or exists(select 1 from pcm.sso_conferencia_lotes c where c.lote_id=p_lote_id and c.revisao>coalesce((select ultima_reabertura_revision from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),0)) then raise exception 'reabra_conferencia' using errcode='23514';end if;
 update pcm.sso_levantamentos set revisao=revisao+1 where id=p_lote_id returning * into v_lote;
 insert into pcm.sso_campos_localizacao_staging(lote_id,linha_chave,revisao,campos,ator_id,request_id,motivo) values(p_lote_id,p_chave,v_lote.revisao,p_campos,auth.uid(),p_request_id,btrim(p_motivo));
 v_resultado:=jsonb_build_object('loteId',p_lote_id,'chave',p_chave,'revision',v_lote.revisao,'requestId',p_request_id,'oficialAlterado',false,'aprovacaoBloqueada',true);
 insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado) values(p_request_id,auth.uid(),v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'levantamento.campos_localizacao_staging','sso_levantamentos',p_lote_id,jsonb_build_object('clienteId',v_lote.cliente_id,'linhaChave',p_chave,'revision',v_lote.revisao,'requestId',p_request_id,'motivo',btrim(p_motivo),'campos',p_campos));return v_resultado;
end;$$;
revoke all on function pcm.sso_editar_campos_localizacao_staging(uuid,uuid,integer,text,jsonb,text,boolean) from public,anon,authenticated,service_role;
-- Não aprovar dados que os comandos oficiais ainda não transportam.
create function pcm.sso_bloquear_conferencia_campos_localizacao() returns trigger language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from pcm.sso_campos_localizacao_staging where lote_id=new.lote_id) then raise exception 'campos_localizacao_ainda_nao_integrados' using errcode='55000';end if;return new;end;$$;
revoke all on function pcm.sso_bloquear_conferencia_campos_localizacao() from public,anon,authenticated,service_role;
create trigger sso_bloquear_conferencia_campos_localizacao before insert on pcm.sso_conferencia_lotes for each row execute function pcm.sso_bloquear_conferencia_campos_localizacao();
