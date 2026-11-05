-- ADR-1316: vínculo distinto para foto com digest; não altera caminho legado.
create table pcm.sso_foto_verificada_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_foto_verificada_grupo_gate(id,habilitado) values(true,false);
create table pcm.sso_foto_verificada_grupo(
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,
 foto_id uuid not null unique references pcm.sso_fotos_levantamento(id),
 grupo_id uuid not null references pcm.grupos_quantitativos(id),cliente_id uuid not null references pcm.clientes(id),
 decisao_revision integer not null check(decisao_revision>0),ator_id uuid not null references auth.users(id),
 payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_foto_verificada_grupo_gate enable row level security;
alter table pcm.sso_foto_verificada_grupo_gate force row level security;
alter table pcm.sso_foto_verificada_grupo enable row level security;
alter table pcm.sso_foto_verificada_grupo force row level security;
revoke all on pcm.sso_foto_verificada_grupo_gate,pcm.sso_foto_verificada_grupo from public,anon,authenticated,service_role;
create trigger sso_foto_verificada_grupo_imutavel before update or delete on pcm.sso_foto_verificada_grupo
 for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_guardar_retirada_foto_verificada_grupo() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.tipo='foto' and exists(select 1 from pcm.sso_foto_verificada_grupo v where v.foto_id=new.anexo_id) then
   raise exception 'foto_vinculada_ao_grupo' using errcode='23514';
 end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_retirada_foto_verificada_grupo() from public,anon,authenticated,service_role;
create trigger sso_guardar_retirada_foto_verificada_grupo before insert on pcm.sso_retiradas_anexo
 for each row execute function pcm.sso_guardar_retirada_foto_verificada_grupo();

create function pcm.sso_vincular_foto_verificada_grupo(
 p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_foto_id uuid,p_grupo_id uuid,p_decisao_revision integer
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_foto pcm.sso_fotos_levantamento%rowtype;v_grupo pcm.grupos_quantitativos%rowtype;
 v_res pcm.sso_ingestao_foto_reservas%rowtype;v_decisao pcm.sso_decisoes_foto_levantamento%rowtype;
 v_ant pcm.sso_foto_verificada_grupo%rowtype;v_payload jsonb;v_resultado jsonb;v_id uuid;
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null
   or p_foto_id is null or p_grupo_id is null or p_decisao_revision is null or p_decisao_revision<1 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_foto_verificada_grupo_gate where id and habilitado for share;
 if not found then raise exception 'vinculo_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_ingestao_foto_gate where id and habilitado for share;
 if not found then raise exception 'ingestao_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_fotos_levantamento_gate where id and habilitado for share;
 if not found then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
 if config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'fotoId',p_foto_id,'grupoId',p_grupo_id,'decisaoRevision',p_decisao_revision);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('foto-verificada-grupo:'||p_request_id::text,0));
 select * into v_foto from pcm.sso_fotos_levantamento where id=p_foto_id and cliente_id=p_cliente_id for update;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_foto_verificada_grupo where request_id=p_request_id;
 if found then
   if v_ant.ator_id is distinct from p_ator_id or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
   perform 1 from pcm.grupos_quantitativos where id=p_grupo_id and cliente_id=p_cliente_id and ativo and deleted_at is null for share;
   if not found or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true
     or config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
   return v_ant.resultado;
 end if;
 select * into v_grupo from pcm.grupos_quantitativos where id=p_grupo_id and cliente_id=p_cliente_id and ativo and deleted_at is null for update;
 if not found or not exists(select 1 from pcm.sso_levantamento_incorporacoes i where i.lote_id=v_foto.lote_id and i.linha_chave=v_foto.linha_chave and i.tipo='grupo_quantitativo' and i.entidade_id=p_grupo_id) then
   raise exception 'grupo_ou_incorporacao_invalida' using errcode='23514'; end if;
 select * into v_res from pcm.sso_ingestao_foto_reservas where foto_id=p_foto_id and cliente_id=p_cliente_id and objeto_id=v_foto.objeto_id and confirmado_em is not null for share;
 if not found or v_res.digest !~ '^[a-f0-9]{64}$' or exists(select 1 from pcm.sso_retiradas_anexo where tipo='foto' and anexo_id=p_foto_id)
   or pcm.sso_foto_inadequada(p_foto_id) or exists(select 1 from pcm.sso_foto_staging_grupo where foto_id=p_foto_id) then
   raise exception 'foto_indisponivel' using errcode='23514'; end if;
 select * into v_decisao from pcm.sso_decisoes_foto_levantamento where foto_id=p_foto_id order by revisao desc limit 1;
 if not found or v_decisao.revisao is distinct from p_decisao_revision or v_decisao.decisao<>'aceita' then raise exception 'decisao_alterada' using errcode='40001'; end if;
 if config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_id:=gen_random_uuid();
 v_resultado:=jsonb_build_object('requestId',p_request_id,'vinculoId',v_id,'fotoId',p_foto_id,'grupoId',p_grupo_id,'revision',p_decisao_revision,'bytesCopiados',false);
 insert into pcm.sso_foto_verificada_grupo(id,request_id,foto_id,grupo_id,cliente_id,decisao_revision,ator_id,payload,resultado)
   values(v_id,p_request_id,p_foto_id,p_grupo_id,p_cliente_id,p_decisao_revision,p_ator_id,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload)
   values(p_ator_id,'grupo.foto_verificada_vinculada','grupos_quantitativos',p_grupo_id,v_resultado);
 return v_resultado;
end; $$;
revoke all on function pcm.sso_vincular_foto_verificada_grupo(uuid,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_vincular_foto_verificada_grupo(uuid,uuid,uuid,uuid,uuid,integer) to authenticated;
