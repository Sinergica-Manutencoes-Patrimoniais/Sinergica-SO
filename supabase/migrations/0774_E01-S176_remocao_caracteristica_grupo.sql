create table pcm.sso_remocao_caracteristica_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_remocao_caracteristica_grupo_gate(id,habilitado) values(true,false);
create table pcm.sso_autorizacoes_remocao_caracteristica(txid bigint not null,grupo_id uuid not null,chave text not null,ator_id uuid not null references auth.users(id),primary key(txid,grupo_id,chave));
create table pcm.sso_remocoes_caracteristica_grupo(request_id uuid primary key,grupo_id uuid not null references pcm.grupos_quantitativos(id),cliente_id uuid not null references pcm.clientes(id),revisao_anterior integer not null,revisao_nova integer not null,chave text not null,motivo text not null,antes jsonb not null,depois jsonb not null,ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now(),unique(grupo_id,revisao_nova));
alter table pcm.sso_remocao_caracteristica_grupo_gate enable row level security;alter table pcm.sso_remocao_caracteristica_grupo_gate force row level security;
alter table pcm.sso_autorizacoes_remocao_caracteristica enable row level security;alter table pcm.sso_autorizacoes_remocao_caracteristica force row level security;
alter table pcm.sso_remocoes_caracteristica_grupo enable row level security;alter table pcm.sso_remocoes_caracteristica_grupo force row level security;
revoke all on pcm.sso_remocao_caracteristica_grupo_gate,pcm.sso_autorizacoes_remocao_caracteristica,pcm.sso_remocoes_caracteristica_grupo from public,anon,authenticated,service_role;
create trigger sso_remocoes_caracteristica_grupo_imutaveis before update or delete on pcm.sso_remocoes_caracteristica_grupo for each row execute function pcm.sso_proteger_conferencia_levantamento();
create or replace function pcm.sso_guardar_caracteristicas_grupo() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_preservar_caracteristicas_grupo_gate where id),false) then return new; end if;
 if old.caracteristicas is distinct from new.caracteristicas then
   if jsonb_typeof(old.caracteristicas) is distinct from 'object' or jsonb_typeof(new.caracteristicas) is distinct from 'object' then raise exception 'caracteristicas_nao_reconciliadas' using errcode='23514'; end if;
   if exists(select 1 from jsonb_object_keys(old.caracteristicas) k(chave) where not (new.caracteristicas ? k.chave) and not (coalesce((select habilitado from pcm.sso_remocao_caracteristica_grupo_gate where id),false) and exists(select 1 from pcm.sso_autorizacoes_remocao_caracteristica a where a.txid=pg_catalog.txid_current() and a.grupo_id=new.id and a.chave=k.chave and a.ator_id=auth.uid()))) then raise exception 'remocao_caracteristica_nao_autorizada' using errcode='23514'; end if;
 end if;return new;
end; $$;
create function pcm.sso_remover_caracteristica_grupo(p_request_id uuid,p_grupo_id uuid,p_expected_revision integer,p_chave text,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_g pcm.grupos_quantitativos%rowtype;v_ant pcm.sso_remocoes_caracteristica_grupo%rowtype;v_payload jsonb;v_antes jsonb;v_resultado jsonb;v_tx bigint:=pg_catalog.txid_current();
begin
 if not coalesce((select habilitado from pcm.sso_remocao_caracteristica_grupo_gate where id),false) or not coalesce((select habilitado from pcm.sso_preservar_caracteristicas_grupo_gate where id),false) then raise exception 'remocao_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_request_id is null or p_grupo_id is null or p_expected_revision is null or p_expected_revision<1 or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or p_chave is distinct from btrim(p_chave) or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('grupoId',p_grupo_id,'expectedRevision',p_expected_revision,'chave',p_chave,'motivo',btrim(p_motivo));perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('remover-caracteristica:'||p_request_id::text,0));
 select * into v_g from pcm.grupos_quantitativos where id=p_grupo_id for update;
 if not found or config.sso_autorizar_acao('cadastro.gerir',v_g.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_remocoes_caracteristica_grupo where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from auth.uid() or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return v_ant.resultado; end if;
 if not v_g.ativo or v_g.deleted_at is not null then raise exception 'grupo_indisponivel' using errcode='23514'; end if;
 if v_g.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if jsonb_typeof(v_g.caracteristicas) is distinct from 'object' or not (v_g.caracteristicas ? p_chave) then raise exception 'caracteristica_indisponivel' using errcode='23514'; end if;
 v_antes:=v_g.caracteristicas;
 insert into pcm.sso_autorizacoes_remocao_caracteristica(txid,grupo_id,chave,ator_id) values(v_tx,p_grupo_id,p_chave,auth.uid());
 update pcm.grupos_quantitativos set caracteristicas=caracteristicas-p_chave,revisao=revisao+1,updated_at=now(),updated_by=auth.uid() where id=p_grupo_id returning * into v_g;
 delete from pcm.sso_autorizacoes_remocao_caracteristica where txid=v_tx and grupo_id=p_grupo_id and chave=p_chave and ator_id=auth.uid();
 v_resultado:=jsonb_build_object('requestId',p_request_id,'grupoId',p_grupo_id,'revision',v_g.revisao,'chave',p_chave);
 insert into pcm.sso_remocoes_caracteristica_grupo(request_id,grupo_id,cliente_id,revisao_anterior,revisao_nova,chave,motivo,antes,depois,ator_id,payload,resultado) values(p_request_id,p_grupo_id,v_g.cliente_id,p_expected_revision,v_g.revisao,p_chave,btrim(p_motivo),v_antes,v_g.caracteristicas,auth.uid(),v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'grupo.caracteristica_removida','grupos_quantitativos',p_grupo_id,v_payload||jsonb_build_object('clienteId',v_g.cliente_id,'revision',v_g.revisao,'antes',v_antes,'depois',v_g.caracteristicas,'requestId',p_request_id));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_remover_caracteristica_grupo(uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
