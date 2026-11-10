-- ADR-0531: aplicação explícita e auditada; gate fechado.
create table pcm.sso_aplicar_campos_sistema_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_aplicar_campos_sistema_gate(id,habilitado) values(true,false);
create table pcm.sso_autorizacoes_campos_sistema(txid bigint not null,lote_id uuid not null,linha_chave text not null,ator_id uuid not null references auth.users(id),primary key(txid,lote_id,linha_chave));
alter table pcm.sso_aplicar_campos_sistema_gate enable row level security;alter table pcm.sso_aplicar_campos_sistema_gate force row level security;
alter table pcm.sso_autorizacoes_campos_sistema enable row level security;alter table pcm.sso_autorizacoes_campos_sistema force row level security;
revoke all on pcm.sso_aplicar_campos_sistema_gate,pcm.sso_autorizacoes_campos_sistema from public,anon,authenticated,service_role;
create or replace function pcm.sso_bloquear_sistema_staging_nao_integrado() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.tipo='sistema' and exists(select 1 from pcm.sso_edicoes_sistema_staging e where e.lote_id=new.lote_id and e.linha_chave=new.linha_chave) and not (coalesce((select habilitado from pcm.sso_aplicar_campos_sistema_gate where id),false) and exists(select 1 from pcm.sso_autorizacoes_campos_sistema a where a.txid=pg_catalog.txid_current() and a.lote_id=new.lote_id and a.linha_chave=new.linha_chave and a.ator_id=auth.uid())) then raise exception 'campos_sistema_ainda_nao_integrados' using errcode='55000'; end if;return new;
end; $$;
create function pcm.sso_snapshot_sistema_campos(p_cliente_id uuid,p_sistema_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_aplicar_campos_sistema_gate where id),false) then raise exception 'aplicacao_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_sistema_id is null or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select jsonb_build_object('id',s.id,'nome',s.nome,'tipo',s.tipo,'descricao',s.descricao,'categoriaId',s.categoria_id,'areaId',s.area_id,'localId',s.local_id,'codigo',s.codigo,'updatedAt',s.updated_at) into v from pcm.sistemas s where s.id=p_sistema_id and s.cliente_id=p_cliente_id and s.ativo and s.deleted_at is null;
 if v is null then raise exception 'sem_acesso' using errcode='42501'; end if;return v;
end; $$;
revoke all on function pcm.sso_snapshot_sistema_campos(uuid,uuid) from public,anon,authenticated,service_role;
create function pcm.sso_aplicar_campos_sistema_levantamento(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_sistema_id uuid,p_snapshot jsonb,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_linha pcm.sso_levantamento_linhas%rowtype;v_cmd pcm.sso_levantamento_comandos%rowtype;v_s pcm.sistemas%rowtype;v_pai record;v_contexto jsonb;v_campos jsonb;v_antes jsonb;v_depois jsonb;v_nome text;v_ref text;v_categoria uuid;v_area uuid;v_local uuid;v_ciclo integer;v_aprovacao integer;v_tx bigint:=pg_catalog.txid_current();v_sync text;v_payload jsonb;v_resultado jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_aplicar_campos_sistema_gate where id),false) or not coalesce((select habilitado from pcm.sso_incorporacao_aprovacao_gate where id),false) then raise exception 'aplicacao_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1 or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or p_sistema_id is null or jsonb_typeof(p_snapshot) is distinct from 'object' or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('operacao','aplicar_campos_sistema','loteId',p_lote_id,'expectedRevision',p_expected_revision,'chave',p_chave,'sistemaId',p_sistema_id,'snapshot',p_snapshot,'motivo',btrim(p_motivo));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_cmd from pcm.sso_levantamento_comandos where request_id=p_request_id;
 if found then if v_cmd.ator_id is distinct from auth.uid() or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return v_cmd.resultado; end if;
 if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 select * into v_linha from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave;
 if not found or v_linha.tipo<>'sistema' or exists(select 1 from pcm.sso_levantamento_incorporacoes where lote_id=p_lote_id and linha_chave=p_chave) or exists(select 1 from pcm.sso_levantamento_rejeicoes where lote_id=p_lote_id and linha_chave=p_chave) then raise exception 'linha_indisponivel' using errcode='23514'; end if;
 if exists(select 1 from jsonb_each(v_linha.atributos) x where x.key not in ('nome','codigoInformado','referenciaPai') and x.value<>'null'::jsonb and x.value<>'""'::jsonb) or jsonb_typeof(v_linha.atributos->'nome') is distinct from 'string' then raise exception 'atributos_nao_suportados' using errcode='23514'; end if;
 v_nome:=btrim(v_linha.atributos->>'nome');if length(v_nome) not between 1 and 200 then raise exception 'nome_invalido' using errcode='22023'; end if;
 select * into v_s from pcm.sistemas where id=p_sistema_id and cliente_id=v_lote.cliente_id and ativo and deleted_at is null for update;
 if not found then raise exception 'sistema_indisponivel' using errcode='42501'; end if;
 v_antes:=pcm.sso_snapshot_sistema_campos(v_lote.cliente_id,p_sistema_id);if v_antes is distinct from p_snapshot then raise exception 'cadastro_divergente' using errcode='40001'; end if;
 if nullif(btrim(v_linha.atributos->>'codigoInformado'),'') is not null and v_linha.atributos->>'codigoInformado' is distinct from v_s.codigo then raise exception 'codigo_divergente' using errcode='23514'; end if;
 v_contexto:=pcm.sso_consultar_campos_sistema_staging(p_lote_id,p_chave);v_campos:=v_contexto->'campos';
 if v_campos='{}'::jsonb or (v_contexto->>'camposConferidos')::boolean is not true then raise exception 'campos_nao_conferidos' using errcode='23514'; end if;
 select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),1),max(revisao) into v_ciclo,v_aprovacao from pcm.sso_conferencia_lotes where lote_id=p_lote_id and revisao>coalesce((select ultima_reabertura_revision from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),0);
 if v_aprovacao is null then v_aprovacao:=pcm.sso_revisao_aprovacao_parcial_campos(p_lote_id,p_chave,v_ciclo,v_campos);end if;
 if v_aprovacao is null or not exists(select 1 from pcm.sso_conferencias_campos_sistema c where c.lote_id=p_lote_id and c.linha_chave=p_chave and c.ciclo=v_ciclo and c.campos=v_campos and c.revisao_lote<v_aprovacao and c.revisao_lote>coalesce((select max(e.revisao_lote) from pcm.sso_edicoes_sistema_staging e where e.lote_id=p_lote_id and e.linha_chave=p_chave),0)) then raise exception 'aprovacao_ou_conferencia_obsoleta' using errcode='40001'; end if;
 v_categoria:=case when v_campos ? 'categoriaId' then (v_campos->>'categoriaId')::uuid else v_s.categoria_id end;
 v_area:=case when v_campos ? 'areaId' then (v_campos->>'areaId')::uuid else v_s.area_id end;
 v_local:=case when v_campos ? 'localId' then (v_campos->>'localId')::uuid else v_s.local_id end;
 if v_categoria is null or not exists(select 1 from pcm.equipamento_categorias where id=v_categoria and deleted_at is null) then raise exception 'categoria_indisponivel' using errcode='23514'; end if;
 if v_area is not null and not exists(select 1 from pcm.areas where id=v_area and cliente_id=v_lote.cliente_id and ativo and deleted_at is null) then raise exception 'area_indisponivel' using errcode='23514'; end if;
 if v_local is not null and not exists(select 1 from pcm.locais l join pcm.areas a on a.id=l.area_id where l.id=v_local and a.cliente_id=v_lote.cliente_id and a.ativo and a.deleted_at is null and l.ativo and l.deleted_at is null and l.area_id=v_area) then raise exception 'local_indisponivel_ou_area_divergente' using errcode='23514'; end if;
 v_ref:=nullif(btrim(v_linha.atributos->>'referenciaPai'),'');
 if v_ref is not null then select i.tipo,i.entidade_id into v_pai from pcm.sso_levantamento_incorporacoes i where i.lote_id=p_lote_id and i.linha_chave=v_ref union all select a.tipo,a.entidade_id from pcm.sso_atualizacoes_localizacao a where a.lote_id=p_lote_id and a.linha_chave=v_ref limit 1; if not found or not ((v_pai.tipo='area' and v_pai.entidade_id=v_area) or (v_pai.tipo in ('local','sublocal') and v_pai.entidade_id=v_local)) then raise exception 'pai_pendente_ou_divergente' using errcode='23514'; end if; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(jsonb_build_array('levantamento_sistema',v_lote.cliente_id,v_area,lower(v_nome))::text,0));
 if exists(select 1 from pcm.sistemas where cliente_id=v_lote.cliente_id and area_id is not distinct from v_area and id<>p_sistema_id and deleted_at is null and lower(nome)=lower(v_nome)) then raise exception 'possivel_duplicidade' using errcode='23505'; end if;
 if config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_sync:=current_setting('app.auvo_sync_write',true);perform pg_catalog.set_config('app.auvo_sync_write','true',true);
 update pcm.sistemas set nome=v_nome,tipo=case when v_campos ? 'tipo' then nullif(btrim(v_campos->>'tipo'),'') else tipo end,descricao=case when v_campos ? 'descricao' then nullif(btrim(v_campos->>'descricao'),'') else descricao end,categoria_id=v_categoria,area_id=v_area,local_id=v_local,updated_by=auth.uid() where id=p_sistema_id;
 perform pg_catalog.set_config('app.auvo_sync_write',coalesce(v_sync,''),true);
 v_depois:=pcm.sso_snapshot_sistema_campos(v_lote.cliente_id,p_sistema_id);
 if v_depois->>'codigo' is distinct from v_antes->>'codigo' then raise exception 'codigo_alterado' using errcode='23514'; end if;
 update pcm.sso_levantamentos set revisao=revisao+1 where id=p_lote_id returning * into v_lote;
 insert into pcm.sso_autorizacoes_campos_sistema(txid,lote_id,linha_chave,ator_id) values(v_tx,p_lote_id,p_chave,auth.uid());
 insert into pcm.sso_levantamento_incorporacoes(lote_id,linha_chave,tipo,entidade_id,revisao,ator_id,request_id) values(p_lote_id,p_chave,'sistema',p_sistema_id,v_lote.revisao,auth.uid(),p_request_id);
 delete from pcm.sso_autorizacoes_campos_sistema where txid=v_tx and lote_id=p_lote_id and linha_chave=p_chave and ator_id=auth.uid();
 v_resultado:=jsonb_build_object('aggregateId',p_lote_id,'revision',v_lote.revisao,'state','pendente','created',false,'linkedIds',jsonb_build_object('entidadeId',p_sistema_id,'tipo','sistema'),'warnings',jsonb_build_array('sincronizacao_auvo_nao_disparada'),'requestId',p_request_id);
 insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado) values(p_request_id,auth.uid(),v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'levantamento.campos_sistema_aplicados','sso_levantamentos',p_lote_id,jsonb_build_object('requestId',p_request_id,'clienteId',v_lote.cliente_id,'linhaChave',p_chave,'motivo',btrim(p_motivo),'antes',v_antes,'depois',v_depois,'campos',v_campos));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_aplicar_campos_sistema_levantamento(uuid,uuid,integer,text,uuid,jsonb,text) from public,anon,authenticated,service_role;
