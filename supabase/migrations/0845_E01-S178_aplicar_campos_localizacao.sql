create table pcm.sso_aplicar_campos_localizacao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_aplicar_campos_localizacao_gate(id,habilitado) values(true,false);
create table pcm.sso_autorizacoes_campos_localizacao(txid bigint not null,lote_id uuid not null,linha_chave text not null,ator_id uuid not null,primary key(txid,lote_id,linha_chave,ator_id));
alter table pcm.sso_aplicar_campos_localizacao_gate enable row level security;alter table pcm.sso_aplicar_campos_localizacao_gate force row level security;
alter table pcm.sso_autorizacoes_campos_localizacao enable row level security;alter table pcm.sso_autorizacoes_campos_localizacao force row level security;
revoke all on pcm.sso_aplicar_campos_localizacao_gate,pcm.sso_autorizacoes_campos_localizacao from public,anon,authenticated,service_role;

create or replace function pcm.sso_bloquear_conferencia_campos_localizacao() returns trigger language plpgsql security definer set search_path='' as $$
declare v_ciclo integer;
begin
 select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=new.lote_id),1) into v_ciclo;
 if exists(select 1 from pcm.sso_campos_localizacao_staging s where s.lote_id=new.lote_id and s.revisao=(select max(x.revisao) from pcm.sso_campos_localizacao_staging x where x.lote_id=s.lote_id and x.linha_chave=s.linha_chave) and (not coalesce((select habilitado from pcm.sso_aplicar_campos_localizacao_gate where id),false) or not exists(select 1 from pcm.sso_conferencias_campos_localizacao c where c.lote_id=s.lote_id and c.linha_chave=s.linha_chave and c.ciclo=v_ciclo and c.revisao_campos=s.revisao and c.campos=s.campos and c.revisao<new.revisao))) then raise exception 'campos_localizacao_nao_conferidos_ou_integracao_desabilitada' using errcode='55000';end if;
 return new;
end;$$;

create function pcm.sso_guardar_integracao_campos_localizacao() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.tipo in ('area','local','sublocal') and exists(select 1 from pcm.sso_campos_localizacao_staging s where s.lote_id=new.lote_id and s.linha_chave=new.linha_chave) and not (coalesce((select habilitado from pcm.sso_aplicar_campos_localizacao_gate where id),false) and exists(select 1 from pcm.sso_autorizacoes_campos_localizacao a where a.txid=pg_catalog.txid_current() and a.lote_id=new.lote_id and a.linha_chave=new.linha_chave and a.ator_id=auth.uid())) then raise exception 'campos_localizacao_exigem_integracao' using errcode='55000';end if;return new;end;$$;
revoke all on function pcm.sso_guardar_integracao_campos_localizacao() from public,anon,authenticated,service_role;
create trigger sso_guardar_integracao_campos_localizacao before insert on pcm.sso_levantamento_incorporacoes for each row execute function pcm.sso_guardar_integracao_campos_localizacao();
create trigger sso_guardar_integracao_campos_localizacao before insert on pcm.sso_atualizacoes_localizacao for each row execute function pcm.sso_guardar_integracao_campos_localizacao();

create function pcm.sso_snapshot_localizacao_completo(p_cliente_id uuid,p_tipo text,p_entidade_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_aplicar_campos_localizacao_gate where id),false) then raise exception 'integracao_desabilitada' using errcode='55000';end if;
 if auth.uid() is null or p_cliente_id is null or p_entidade_id is null or p_tipo not in ('area','local','sublocal') or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501';end if;
 if p_tipo='area' then select to_jsonb(a) into v from pcm.areas a where a.id=p_entidade_id and a.cliente_id=p_cliente_id and a.ativo and a.deleted_at is null;
 else select to_jsonb(l) into v from pcm.locais l join pcm.areas a on a.id=l.area_id where l.id=p_entidade_id and a.cliente_id=p_cliente_id and a.ativo and a.deleted_at is null and l.ativo and l.deleted_at is null and ((p_tipo='local' and l.parent_id is null) or (p_tipo='sublocal' and l.parent_id is not null));end if;
 if v is null then raise exception 'localizacao_indisponivel' using errcode='42501';end if;return v;
end;$$;
revoke all on function pcm.sso_snapshot_localizacao_completo(uuid,text,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_aplicar_campos_localizacao(p_request_id uuid,p_request_individual uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_entidade_id uuid,p_snapshot jsonb,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_linha pcm.sso_levantamento_linhas%rowtype;v_campos pcm.sso_campos_localizacao_staging%rowtype;v_cmd pcm.sso_levantamento_comandos%rowtype;v_payload jsonb;v_resultado jsonb;v_individual jsonb;v_antes jsonb;v_apos_nome jsonb;v_depois jsonb;v_ciclo integer;v_aprovacao integer;v_sync text;
begin
 if not coalesce((select habilitado from pcm.sso_aplicar_campos_localizacao_gate where id),false) or not coalesce((select habilitado from pcm.sso_incorporacao_aprovacao_gate where id),false) then raise exception 'integracao_desabilitada' using errcode='55000';end if;
 if auth.uid() is null or p_request_id is null or p_request_individual is null or p_request_id=p_request_individual or p_lote_id is null or p_expected_revision is null or p_expected_revision<1 or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 or ((p_entidade_id is null)<>(p_snapshot is null)) or (p_snapshot is not null and jsonb_typeof(p_snapshot) is distinct from 'object') then raise exception 'parametros_invalidos' using errcode='22023';end if;
 v_payload:=jsonb_build_object('operacao','aplicar_campos_localizacao','requestIndividual',p_request_individual,'loteId',p_lote_id,'expectedRevision',p_expected_revision,'chave',p_chave,'entidadeId',p_entidade_id,'snapshot',p_snapshot,'motivo',btrim(p_motivo));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_cmd from pcm.sso_levantamento_comandos where request_id=p_request_id;
 if found then if v_cmd.ator_id is distinct from auth.uid() or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_cmd.resultado;end if;
 if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 if exists(select 1 from pcm.sso_levantamento_comandos where request_id=p_request_individual) then raise exception 'request_individual_ja_utilizado' using errcode='23505';end if;
 select * into v_linha from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave;
 if not found or v_linha.tipo not in ('area','local','sublocal') then raise exception 'linha_indisponivel' using errcode='23514';end if;
 select * into v_campos from pcm.sso_campos_localizacao_staging where lote_id=p_lote_id and linha_chave=p_chave order by revisao desc limit 1;
 if not found then raise exception 'campos_nao_declarados' using errcode='23514';end if;
 select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),1),max(revisao) into v_ciclo,v_aprovacao from pcm.sso_conferencia_lotes where lote_id=p_lote_id and revisao>coalesce((select ultima_reabertura_revision from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),0);
 if v_aprovacao is null then v_aprovacao:=pcm.sso_revisao_aprovacao_parcial_campos(p_lote_id,p_chave,v_ciclo,v_campos.campos);end if;
 if v_aprovacao is null or not exists(select 1 from pcm.sso_conferencias_campos_localizacao c where c.lote_id=p_lote_id and c.linha_chave=p_chave and c.ciclo=v_ciclo and c.revisao_campos=v_campos.revisao and c.campos=v_campos.campos and c.revisao<v_aprovacao) then raise exception 'campos_ou_lote_nao_conferidos' using errcode='23514';end if;
 if p_entidade_id is not null then
  if v_linha.tipo='area' then perform 1 from pcm.areas where id=p_entidade_id and cliente_id=v_lote.cliente_id for update;else perform 1 from pcm.locais l join pcm.areas a on a.id=l.area_id where l.id=p_entidade_id and a.cliente_id=v_lote.cliente_id for update of l;end if;
  if not found then raise exception 'localizacao_indisponivel' using errcode='42501';end if;
  v_antes:=pcm.sso_snapshot_localizacao_completo(v_lote.cliente_id,v_linha.tipo,p_entidade_id);if v_antes is distinct from p_snapshot then raise exception 'cadastro_divergente' using errcode='40001';end if;
 end if;
 insert into pcm.sso_autorizacoes_campos_localizacao(txid,lote_id,linha_chave,ator_id) values(pg_catalog.txid_current(),p_lote_id,p_chave,auth.uid());
 v_sync:=current_setting('app.auvo_sync_write',true);perform pg_catalog.set_config('app.auvo_sync_write','true',true);
 if p_entidade_id is null then v_individual:=pcm.sso_incorporar_localizacao_levantamento(p_request_individual,p_lote_id,p_expected_revision,p_chave);
 else v_individual:=pcm.sso_atualizar_localizacao_levantamento(p_request_individual,p_lote_id,p_expected_revision,p_chave,p_entidade_id,pcm.sso_snapshot_localizacao_levantamento(v_lote.cliente_id,v_linha.tipo,p_entidade_id),p_motivo);end if;
 p_entidade_id:=(v_individual->'linkedIds'->>'entidadeId')::uuid;
 v_apos_nome:=pcm.sso_snapshot_localizacao_completo(v_lote.cliente_id,v_linha.tipo,p_entidade_id);
 if v_linha.tipo='area' then update pcm.areas set descricao=case when v_campos.campos ? 'descricao' then v_campos.campos->>'descricao' else descricao end,ordem=case when v_campos.campos ? 'ordem' then (v_campos.campos->>'ordem')::integer else ordem end,updated_by=auth.uid() where id=p_entidade_id and cliente_id=v_lote.cliente_id;
 else update pcm.locais set descricao=case when v_campos.campos ? 'descricao' then v_campos.campos->>'descricao' else descricao end,tipo=case when v_campos.campos ? 'tipo' then v_campos.campos->>'tipo' else tipo end,ordem=case when v_campos.campos ? 'ordem' then (v_campos.campos->>'ordem')::integer else ordem end,updated_by=auth.uid() where id=p_entidade_id;end if;
 v_depois:=pcm.sso_snapshot_localizacao_completo(v_lote.cliente_id,v_linha.tipo,p_entidade_id);
 if (v_apos_nome - array['descricao','tipo','ordem','updated_at','updated_by']) is distinct from (v_depois - array['descricao','tipo','ordem','updated_at','updated_by']) then raise exception 'identidade_ou_hierarquia_alterada' using errcode='23514';end if;
 perform pg_catalog.set_config('app.auvo_sync_write',coalesce(v_sync,''),true);delete from pcm.sso_autorizacoes_campos_localizacao where txid=pg_catalog.txid_current() and lote_id=p_lote_id and linha_chave=p_chave and ator_id=auth.uid();
 v_resultado:=jsonb_build_object('loteId',p_lote_id,'chave',p_chave,'revision',(v_individual->>'revision')::integer,'entidadeId',p_entidade_id,'created',v_individual->'created','requestId',p_request_id,'sincronizacaoAuvoDisparada',false);
 insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado) values(p_request_id,auth.uid(),v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'levantamento.campos_localizacao_aplicados','sso_levantamentos',p_lote_id,jsonb_build_object('clienteId',v_lote.cliente_id,'linhaChave',p_chave,'requestId',p_request_id,'motivo',btrim(p_motivo),'antes',v_antes,'depois',v_depois,'campos',v_campos.campos));return v_resultado;
end;$$;
revoke all on function pcm.sso_aplicar_campos_localizacao(uuid,uuid,uuid,integer,text,uuid,jsonb,text) from public,anon,authenticated,service_role;
