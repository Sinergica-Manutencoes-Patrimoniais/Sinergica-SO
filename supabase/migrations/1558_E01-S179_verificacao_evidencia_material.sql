-- ADR-1414: vínculo exige atestado da borda após leitura dos bytes privados.
create table pcm.sso_verificacao_material_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_verificacao_material_gate(id,habilitado) values(true,false);
alter table pcm.sso_verificacao_material_gate enable row level security;
alter table pcm.sso_verificacao_material_gate force row level security;
revoke all on pcm.sso_verificacao_material_gate from public,anon,authenticated,service_role;
create table pcm.sso_verificacoes_material(
 request_id uuid primary key,ator_id uuid not null,cliente_id uuid not null,lista_id uuid not null,evento_revision integer not null,
 objeto_id uuid not null,digest text not null check(digest ~ '^[a-f0-9]{64}$'),mime text not null check(mime in ('image/jpeg','image/png')),
 metadata jsonb,atualizado_em timestamptz,criado_em timestamptz not null default now());
alter table pcm.sso_verificacoes_material enable row level security;
alter table pcm.sso_verificacoes_material force row level security;
revoke all on pcm.sso_verificacoes_material from public,anon,authenticated,service_role;
create trigger sso_verificacoes_material_imutaveis before update or delete on pcm.sso_verificacoes_material for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_info_objeto_material_servico(p_ator_id uuid,p_cliente_id uuid,p_lista_id uuid,p_evento_revision integer,p_objeto_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_nome text;v_metadata jsonb;v_atualizado timestamptz;
begin
 if coalesce(auth.role(),'')<>'service_role' or p_ator_id is null or p_cliente_id is null or p_lista_id is null or p_evento_revision is null or p_evento_revision<1 or p_objeto_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.sso_verificacao_material_gate where id and habilitado for share;
 if not found then raise exception 'verificacao_desabilitada' using errcode='55000'; end if;
 select o.name,o.metadata,o.updated_at into v_nome,v_metadata,v_atualizado from storage.objects o join storage.buckets b on b.id=o.bucket_id and b.public is false
   join pcm.listas_materiais l on l.id=p_lista_id and l.cliente_id=p_cliente_id
   join pcm.sso_lista_materiais_eventos e on e.lista_id=l.id and e.revisao=p_evento_revision and e.tipo='excecao'
   where o.id=p_objeto_id and o.bucket_id='sso-material-evidencias' and o.owner_id=p_ator_id::text
   and split_part(o.name,'/',1)=p_cliente_id::text and split_part(o.name,'/',2)=p_lista_id::text and split_part(o.name,'/',3)=p_evento_revision::text;
 if v_nome is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 return jsonb_build_object('objetoId',p_objeto_id,'nome',v_nome,'metadata',v_metadata,'atualizadoEm',v_atualizado);
end; $$;
revoke all on function pcm.sso_info_objeto_material_servico(uuid,uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_info_objeto_material_servico(uuid,uuid,uuid,integer,uuid) to service_role;

create function pcm.sso_atestar_material_servico(p_ator_id uuid,p_cliente_id uuid,p_lista_id uuid,p_evento_revision integer,p_request_id uuid,p_objeto_id uuid,p_digest text,p_mime text,p_metadata jsonb,p_atualizado_em timestamptz)
returns void language plpgsql volatile security definer set search_path='' as $$
declare v_ant pcm.sso_verificacoes_material%rowtype;
begin
 if coalesce(auth.role(),'')<>'service_role' or p_ator_id is null or p_cliente_id is null or p_lista_id is null or p_evento_revision is null or p_evento_revision<1 or p_request_id is null or p_objeto_id is null or p_digest is null or p_digest !~ '^[a-f0-9]{64}$' or p_mime not in ('image/jpeg','image/png') then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.sso_verificacao_material_gate where id and habilitado for share;
 if not found then raise exception 'verificacao_desabilitada' using errcode='55000'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('material-verificacao:'||p_request_id::text,0));
 perform 1 from storage.objects o join storage.buckets b on b.id=o.bucket_id and b.public is false
   join pcm.listas_materiais l on l.id=p_lista_id and l.cliente_id=p_cliente_id
   join pcm.sso_lista_materiais_eventos e on e.lista_id=l.id and e.revisao=p_evento_revision and e.tipo='excecao'
   where o.id=p_objeto_id and o.bucket_id='sso-material-evidencias' and o.owner_id=p_ator_id::text
   and split_part(o.name,'/',1)=p_cliente_id::text and split_part(o.name,'/',2)=p_lista_id::text and split_part(o.name,'/',3)=p_evento_revision::text
   and o.metadata is not distinct from p_metadata and o.updated_at is not distinct from p_atualizado_em for share of o,b;
 if not found then raise exception 'objeto_alterado' using errcode='23514'; end if;
 select * into v_ant from pcm.sso_verificacoes_material where request_id=p_request_id;
 if found then
   if v_ant.ator_id is distinct from p_ator_id or v_ant.cliente_id is distinct from p_cliente_id or v_ant.lista_id is distinct from p_lista_id
     or v_ant.evento_revision is distinct from p_evento_revision or v_ant.objeto_id is distinct from p_objeto_id or v_ant.digest is distinct from p_digest
     or v_ant.mime is distinct from p_mime or v_ant.metadata is distinct from p_metadata or v_ant.atualizado_em is distinct from p_atualizado_em then raise exception 'request_conflitante' using errcode='23505'; end if;
 else
   insert into pcm.sso_verificacoes_material(request_id,ator_id,cliente_id,lista_id,evento_revision,objeto_id,digest,mime,metadata,atualizado_em)
     values(p_request_id,p_ator_id,p_cliente_id,p_lista_id,p_evento_revision,p_objeto_id,p_digest,p_mime,p_metadata,p_atualizado_em);
 end if;
end; $$;
revoke all on function pcm.sso_atestar_material_servico(uuid,uuid,uuid,integer,uuid,uuid,text,text,jsonb,timestamptz) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_atestar_material_servico(uuid,uuid,uuid,integer,uuid,uuid,text,text,jsonb,timestamptz) to service_role;

create or replace function pcm.sso_vincular_evidencia_material_mediada(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_lista_id uuid,p_evento_revision integer,p_objeto_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null or p_lista_id is null or p_evento_revision is null or p_evento_revision<1 or p_objeto_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_ingestao_material_mediada_gate where id and upload and vinculo for share;
 if not found then raise exception 'ingestao_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_verificacao_material_gate where id and habilitado for share;
 if not found then raise exception 'verificacao_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.listas_materiais l where l.id=p_lista_id and l.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.sso_verificacoes_material a join storage.objects o on o.id=a.objeto_id and o.metadata is not distinct from a.metadata and o.updated_at is not distinct from a.atualizado_em
   join storage.buckets b on b.id=o.bucket_id and b.public is false where a.request_id=p_request_id and a.ator_id=p_ator_id and a.cliente_id=p_cliente_id
   and a.lista_id=p_lista_id and a.evento_revision=p_evento_revision and a.objeto_id=p_objeto_id for share of o,b;
 if not found then raise exception 'verificacao_ausente_ou_objeto_alterado' using errcode='23514'; end if;
 v_resultado:=pcm.sso_vincular_evidencia_material(p_request_id,p_lista_id,p_evento_revision,p_objeto_id);
 if config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
