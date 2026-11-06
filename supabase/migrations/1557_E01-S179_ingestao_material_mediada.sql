-- ADR-1413: recepção em objeto privado e vínculo sujeitos a gates separados.
create table pcm.sso_ingestao_material_mediada_gate(id boolean primary key default true check(id),upload boolean not null default false,vinculo boolean not null default false);
insert into pcm.sso_ingestao_material_mediada_gate(id,upload,vinculo) values(true,false,false);
alter table pcm.sso_ingestao_material_mediada_gate enable row level security;
alter table pcm.sso_ingestao_material_mediada_gate force row level security;
revoke all on pcm.sso_ingestao_material_mediada_gate from public,anon,authenticated,service_role;

-- O helper é usado pelas políticas existentes de Storage; nenhum caminho é retornado.
create or replace function pcm.sso_autorizar_upload_evidencia_material(p_nome text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare v text[];
begin
 if auth.uid() is null or not coalesce((select upload from pcm.sso_ingestao_material_mediada_gate where id),false)
   or not coalesce((select habilitado from pcm.sso_material_evidencia_gate where id),false) then return false; end if;
 v:=string_to_array(p_nome,'/');
 if array_length(v,1) is distinct from 4 or v[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or v[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or v[3] !~ '^[1-9][0-9]{0,8}$'
   or v[4] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
 return exists(select 1 from pcm.listas_materiais l join pcm.sso_lista_materiais_eventos e on e.lista_id=l.id and e.revisao=v[3]::integer and e.tipo='excecao'
   join pcm.ordens_servico os on os.id=l.ordem_servico_id and os.client_id=l.cliente_id and os.deleted_at is null
   where l.id=v[2]::uuid and l.cliente_id=v[1]::uuid and config.sso_autorizar_acao('material.gerir',l.cliente_id) is true);
end; $$;
revoke all on function pcm.sso_autorizar_upload_evidencia_material(text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_autorizar_upload_evidencia_material(text) to authenticated;

create function pcm.sso_resolver_upload_material_mediado(p_ator_id uuid,p_cliente_id uuid,p_lista_id uuid,p_evento_revision integer,p_nome text) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare v_id uuid;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_lista_id is null or p_evento_revision is null or p_evento_revision<1 or p_nome is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_ingestao_material_mediada_gate where id and upload and vinculo for share;
 if not found then raise exception 'ingestao_desabilitada' using errcode='55000'; end if;
 if split_part(p_nome,'/',1)<>p_cliente_id::text or split_part(p_nome,'/',2)<>p_lista_id::text or split_part(p_nome,'/',3)<>p_evento_revision::text
   or config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_id:=pcm.sso_resolver_upload_evidencia_material(p_nome);
 if config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_id;
end; $$;
revoke all on function pcm.sso_resolver_upload_material_mediado(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_resolver_upload_material_mediado(uuid,uuid,uuid,integer,text) to authenticated;

create function pcm.sso_vincular_evidencia_material_mediada(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_lista_id uuid,p_evento_revision integer,p_objeto_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null or p_lista_id is null or p_evento_revision is null or p_evento_revision<1 or p_objeto_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_ingestao_material_mediada_gate where id and upload and vinculo for share;
 if not found then raise exception 'ingestao_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.listas_materiais l where l.id=p_lista_id and l.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=pcm.sso_vincular_evidencia_material(p_request_id,p_lista_id,p_evento_revision,p_objeto_id);
 if config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_vincular_evidencia_material_mediada(uuid,uuid,uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_vincular_evidencia_material_mediada(uuid,uuid,uuid,uuid,integer,uuid) to authenticated;
