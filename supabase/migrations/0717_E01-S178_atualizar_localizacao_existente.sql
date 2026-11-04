-- ADR-0491: atualização restrita, auditada e sem alterar hierarquia.
create table pcm.sso_atualizacao_localizacao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_atualizacao_localizacao_gate(id,habilitado) values(true,false);
create table pcm.sso_atualizacoes_localizacao(lote_id uuid not null,linha_chave text not null,tipo text not null check(tipo in ('area','local','sublocal')),entidade_id uuid not null,revisao integer not null,ator_id uuid not null references auth.users(id),request_id uuid not null unique,criado_em timestamptz not null default now(),primary key(lote_id,linha_chave),foreign key(lote_id,linha_chave) references pcm.sso_levantamento_linhas(lote_id,chave));
alter table pcm.sso_atualizacao_localizacao_gate enable row level security;alter table pcm.sso_atualizacao_localizacao_gate force row level security;
alter table pcm.sso_atualizacoes_localizacao enable row level security;alter table pcm.sso_atualizacoes_localizacao force row level security;
revoke all on pcm.sso_atualizacao_localizacao_gate,pcm.sso_atualizacoes_localizacao from public,anon,authenticated,service_role;
create trigger sso_atualizacoes_localizacao_imutaveis before update or delete on pcm.sso_atualizacoes_localizacao for each row execute function pcm.sso_proteger_incorporacao_levantamento();
create trigger sso_atualizacao_localizacao_exige_conferencia before insert on pcm.sso_atualizacoes_localizacao for each row execute function pcm.sso_exigir_lote_conferido();
-- A nova trilha também bloqueia alterações posteriores que só conheciam incorporações legadas.
create function pcm.sso_guardar_lote_localizacao_atualizada() returns trigger language plpgsql security definer set search_path='' as $$
declare v_lote uuid;
begin
 if tg_op='DELETE' then v_lote:=old.lote_id; else v_lote:=new.lote_id; end if;
 if exists(select 1 from pcm.sso_atualizacoes_localizacao a where a.lote_id=v_lote) then raise exception 'lote_ja_atualizado' using errcode='23514'; end if;
 if tg_op='DELETE' then return old; end if;return new;
end; $$;
revoke all on function pcm.sso_guardar_lote_localizacao_atualizada() from public,anon,authenticated,service_role;
create trigger sso_guardar_lote_localizacao_atualizada before update or delete on pcm.sso_levantamento_linhas for each row execute function pcm.sso_guardar_lote_localizacao_atualizada();
create trigger sso_guardar_lote_localizacao_atualizada before insert or update on pcm.sso_conferencia_ciclos for each row execute function pcm.sso_guardar_lote_localizacao_atualizada();
create trigger sso_guardar_lote_localizacao_atualizada before insert or delete on pcm.sso_levantamento_rejeicoes for each row execute function pcm.sso_guardar_lote_localizacao_atualizada();
create function pcm.sso_guardar_linha_localizacao_atualizada() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from pcm.sso_atualizacoes_localizacao a where a.lote_id=new.lote_id and a.linha_chave=new.linha_chave) then raise exception 'linha_ja_atualizada' using errcode='23514'; end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_linha_localizacao_atualizada() from public,anon,authenticated,service_role;
create trigger sso_guardar_linha_localizacao_atualizada before insert on pcm.sso_levantamento_incorporacoes for each row execute function pcm.sso_guardar_linha_localizacao_atualizada();
create function pcm.sso_snapshot_localizacao_levantamento(p_cliente_id uuid,p_tipo text,p_entidade_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_atualizacao_localizacao_gate where id),false) then raise exception 'atualizacao_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_entidade_id is null or p_tipo is null or p_tipo not in ('area','local','sublocal') then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_tipo='area' then select jsonb_build_object('id',a.id,'nome',a.nome,'areaId',null,'parentId',null) into v from pcm.areas a where a.id=p_entidade_id and a.cliente_id=p_cliente_id and a.ativo and a.deleted_at is null;
 else select jsonb_build_object('id',l.id,'nome',l.nome,'areaId',l.area_id,'parentId',l.parent_id) into v from pcm.locais l join pcm.areas a on a.id=l.area_id where l.id=p_entidade_id and a.cliente_id=p_cliente_id and a.ativo and a.deleted_at is null and l.ativo and l.deleted_at is null and ((p_tipo='local' and l.parent_id is null) or (p_tipo='sublocal' and l.parent_id is not null)); end if;
 if v is null then raise exception 'localizacao_indisponivel' using errcode='42501'; end if;return v;
end; $$;
revoke all on function pcm.sso_snapshot_localizacao_levantamento(uuid,text,uuid) from public,anon,authenticated,service_role;
create function pcm.sso_atualizar_localizacao_levantamento(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_entidade_id uuid,p_snapshot jsonb,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_linha pcm.sso_levantamento_linhas%rowtype;v_cmd pcm.sso_levantamento_comandos%rowtype;v_pai pcm.sso_levantamento_incorporacoes%rowtype;v_atual jsonb;v_depois jsonb;v_nome text;v_ref text;v_payload jsonb;v_resultado jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_atualizacao_localizacao_gate where id),false) then raise exception 'atualizacao_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1 or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or p_entidade_id is null or jsonb_typeof(p_snapshot) is distinct from 'object' or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('operacao','atualizar_localizacao','loteId',p_lote_id,'expectedRevision',p_expected_revision,'chave',p_chave,'entidadeId',p_entidade_id,'snapshot',p_snapshot,'motivo',btrim(p_motivo));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_cmd from pcm.sso_levantamento_comandos where request_id=p_request_id;
 if found then if v_cmd.ator_id is distinct from auth.uid() or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return v_cmd.resultado; end if;
 if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 select * into v_linha from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave;
 if not found or v_linha.tipo not in ('area','local','sublocal') or exists(select 1 from pcm.sso_levantamento_incorporacoes where lote_id=p_lote_id and linha_chave=p_chave) or exists(select 1 from pcm.sso_atualizacoes_localizacao where lote_id=p_lote_id and linha_chave=p_chave) or exists(select 1 from pcm.sso_levantamento_rejeicoes where lote_id=p_lote_id and linha_chave=p_chave) then raise exception 'linha_indisponivel' using errcode='23514'; end if;
 if exists(select 1 from jsonb_each(v_linha.atributos) x where x.key not in ('nome','codigoInformado','referenciaPai') and x.value<>'null'::jsonb and x.value<>'""'::jsonb) or nullif(btrim(v_linha.atributos->>'codigoInformado'),'') is not null or jsonb_typeof(v_linha.atributos->'nome') is distinct from 'string' then raise exception 'atributos_nao_suportados' using errcode='23514'; end if;
 v_nome:=btrim(v_linha.atributos->>'nome'); if length(v_nome) not between 1 and 200 then raise exception 'nome_invalido' using errcode='22023'; end if;
 if v_linha.tipo='area' then perform 1 from pcm.areas where id=p_entidade_id and cliente_id=v_lote.cliente_id for update; else perform 1 from pcm.locais l join pcm.areas a on a.id=l.area_id where l.id=p_entidade_id and a.cliente_id=v_lote.cliente_id for update of l; end if;
 if not found then raise exception 'localizacao_indisponivel' using errcode='42501'; end if;
 v_atual:=pcm.sso_snapshot_localizacao_levantamento(v_lote.cliente_id,v_linha.tipo,p_entidade_id);if v_atual is distinct from p_snapshot then raise exception 'cadastro_divergente' using errcode='40001'; end if;
 v_ref:=nullif(btrim(v_linha.atributos->>'referenciaPai'),'');
 if v_linha.tipo='area' and v_ref is not null then raise exception 'pai_invalido' using errcode='23514'; end if;
 if v_linha.tipo<>'area' then select * into v_pai from pcm.sso_levantamento_incorporacoes where lote_id=p_lote_id and linha_chave=v_ref; if not found then select a.tipo,a.entidade_id into v_pai.tipo,v_pai.entidade_id from pcm.sso_atualizacoes_localizacao a where a.lote_id=p_lote_id and a.linha_chave=v_ref; end if; if not found or (v_linha.tipo='local' and (v_pai.tipo<>'area' or v_pai.entidade_id::text is distinct from v_atual->>'areaId')) or (v_linha.tipo='sublocal' and (v_pai.tipo not in ('local','sublocal') or v_pai.entidade_id::text is distinct from v_atual->>'parentId')) then raise exception 'pai_pendente_ou_divergente' using errcode='23514'; end if; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(jsonb_build_array('levantamento_localizacao',v_lote.cliente_id,v_linha.tipo,v_atual->>'areaId',v_atual->>'parentId',lower(v_nome))::text,0));
 if v_linha.tipo='area' then if exists(select 1 from pcm.areas where cliente_id=v_lote.cliente_id and id<>p_entidade_id and deleted_at is null and lower(nome)=lower(v_nome)) then raise exception 'possivel_duplicidade' using errcode='23505'; end if; update pcm.areas set nome=v_nome,updated_by=auth.uid() where id=p_entidade_id;
 else if exists(select 1 from pcm.locais l where l.area_id=(v_atual->>'areaId')::uuid and l.parent_id is not distinct from (v_atual->>'parentId')::uuid and l.id<>p_entidade_id and l.deleted_at is null and lower(l.nome)=lower(v_nome)) then raise exception 'possivel_duplicidade' using errcode='23505'; end if; update pcm.locais set nome=v_nome,updated_by=auth.uid() where id=p_entidade_id; end if;
 v_depois:=pcm.sso_snapshot_localizacao_levantamento(v_lote.cliente_id,v_linha.tipo,p_entidade_id);
 update pcm.sso_levantamentos set revisao=revisao+1 where id=p_lote_id returning * into v_lote;
 insert into pcm.sso_atualizacoes_localizacao(lote_id,linha_chave,tipo,entidade_id,revisao,ator_id,request_id) values(p_lote_id,p_chave,v_linha.tipo,p_entidade_id,v_lote.revisao,auth.uid(),p_request_id);
 v_resultado:=jsonb_build_object('aggregateId',p_lote_id,'revision',v_lote.revisao,'state','pendente','created',false,'linkedIds',jsonb_build_object('entidadeId',p_entidade_id,'tipo',v_linha.tipo),'warnings',jsonb_build_array('somente_nome_atualizado'),'requestId',p_request_id);
 insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado) values(p_request_id,auth.uid(),v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'levantamento.localizacao_atualizada','sso_levantamentos',p_lote_id,jsonb_build_object('requestId',p_request_id,'clienteId',v_lote.cliente_id,'linhaChave',p_chave,'motivo',btrim(p_motivo),'antes',v_atual,'depois',v_depois));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_atualizar_localizacao_levantamento(uuid,uuid,integer,text,uuid,jsonb,text) from public,anon,authenticated,service_role;
