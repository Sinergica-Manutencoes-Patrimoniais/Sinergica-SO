-- ADR-1466: acesso mediado aos comandos e leituras existentes.
create table pcm.sso_visibilidade_materiais_mediada_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_visibilidade_materiais_mediada_gate(id,habilitado) values(true,false);
alter table pcm.sso_visibilidade_materiais_mediada_gate enable row level security;
alter table pcm.sso_visibilidade_materiais_mediada_gate force row level security;
revoke all on pcm.sso_visibilidade_materiais_mediada_gate from public,anon,authenticated,service_role;

create function pcm.sso_guardar_visibilidade_material(p_ator_id uuid,p_cliente_id uuid,p_lista_id uuid,p_escrita boolean)
returns void language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_visibilidade_materiais_mediada_gate where id and habilitado for share;
 if not found then raise exception 'visibilidade_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_lista_id is null
   or config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_escrita then
   perform 1 from pcm.listas_materiais where id=p_lista_id and cliente_id=p_cliente_id for update;
 else
   perform 1 from pcm.listas_materiais where id=p_lista_id and cliente_id=p_cliente_id for share;
 end if;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_guardar_visibilidade_material(uuid,uuid,uuid,boolean) from public,anon,authenticated,service_role;

create function pcm.sso_status_material_mediado(p_ator_id uuid,p_cliente_id uuid,p_lista_id uuid)
returns table(revisao_publicacao integer,situacao text,aplicavel boolean) language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_guardar_visibilidade_material(p_ator_id,p_cliente_id,p_lista_id,false);
 return query select * from pcm.sso_status_publicacao_materiais(p_cliente_id,p_lista_id);
 if config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
create function pcm.sso_historico_material_mediado(p_ator_id uuid,p_cliente_id uuid,p_lista_id uuid,p_apos integer)
returns table(revisao_publicacao integer,sequencia integer,acao text,motivo text,ator_id uuid,criado_em timestamptz) language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_guardar_visibilidade_material(p_ator_id,p_cliente_id,p_lista_id,false);
 return query select * from pcm.sso_historico_visibilidade_materiais(p_cliente_id,p_lista_id,p_apos);
 if config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
create function pcm.sso_visibilidade_material_mediada(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_lista_id uuid,p_revisao_publicacao integer,p_acao text,p_motivo text)
returns integer language plpgsql volatile security definer set search_path='' as $$
declare v_resultado integer;
begin
 if p_request_id is null then raise exception 'dados_invalidos' using errcode='22023'; end if;
 -- Mesma ordem do núcleo: request antes da lista, inclusive no replay.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('material-visibilidade:'||p_request_id::text,0));
 perform pcm.sso_guardar_visibilidade_material(p_ator_id,p_cliente_id,p_lista_id,true);
 v_resultado:=pcm.sso_portal_material_visibilidade(p_request_id,p_lista_id,p_revisao_publicacao,p_acao,p_motivo);
 if config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_status_material_mediado(uuid,uuid,uuid),pcm.sso_historico_material_mediado(uuid,uuid,uuid,integer),pcm.sso_visibilidade_material_mediada(uuid,uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_status_material_mediado(uuid,uuid,uuid),pcm.sso_historico_material_mediado(uuid,uuid,uuid,integer),pcm.sso_visibilidade_material_mediada(uuid,uuid,uuid,uuid,integer,text,text) to authenticated;
