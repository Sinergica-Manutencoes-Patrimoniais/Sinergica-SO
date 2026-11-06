-- ADR-1403: leitura pública mínima e resolvedor exclusivo de serviço.
create table pcm.sso_portal_anexos_mediados_gate(id boolean primary key default true check(id),leitura boolean not null default false,download boolean not null default false);
insert into pcm.sso_portal_anexos_mediados_gate(id,leitura,download) values(true,false,false);
alter table pcm.sso_portal_anexos_mediados_gate enable row level security;
alter table pcm.sso_portal_anexos_mediados_gate force row level security;
revoke all on pcm.sso_portal_anexos_mediados_gate from public,anon,authenticated,service_role;

create function pcm.sso_portal_listar_anexos_os_mediado(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_apos uuid)
returns table(id uuid,titulo text,publicado_em timestamptz) language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_portal_anexos_mediados_gate where id and leitura for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_portal_anexo_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_os_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from config.usuario_cliente uc join config.usuarios u on u.user_id=uc.user_id where uc.user_id=p_ator_id and uc.cliente_id=p_cliente_id and u.ativo and u.papel='cliente-sindico' for share of uc,u;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.ordens_servico where pcm.ordens_servico.id=p_os_id and client_id=p_cliente_id and deleted_at is null for share;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from pcm.sso_portal_listar_anexos_os(p_cliente_id,p_os_id,p_apos);
end; $$;
revoke all on function pcm.sso_portal_listar_anexos_os_mediado(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_portal_listar_anexos_os_mediado(uuid,uuid,uuid,uuid) to authenticated;

create function pcm.sso_portal_anexo_os_servico(p_usuario_id uuid,p_publicacao_id uuid) returns text
language plpgsql volatile security definer set search_path='' as $$
declare v_caminho text;
begin
 if current_setting('transaction_isolation')<>'read committed' or coalesce(auth.role(),'')<>'service_role' or p_usuario_id is null or p_publicacao_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_portal_anexos_mediados_gate where id and download for share;
 if not found then raise exception 'download_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_portal_anexo_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 select p.caminho into v_caminho from pcm.sso_portal_anexos_publicacoes p
   join pcm.ordens_servico os on os.id=p.ordem_servico_id and os.client_id=p.cliente_id and os.deleted_at is null
   join pcm.os_notas n on n.id=p.nota_id and n.cliente_id=p.cliente_id and n.ordem_servico_id=p.ordem_servico_id and n.anexo_path=p.caminho
   join storage.objects o on o.id=p.objeto_id and o.bucket_id='os-anexos' and o.name=p.caminho and o.metadata is not distinct from p.metadata_snapshot and o.updated_at is not distinct from p.objeto_updated_at
   join storage.buckets b on b.id=o.bucket_id and b.public is false
   join config.usuario_cliente uc on uc.cliente_id=p.cliente_id and uc.user_id=p_usuario_id
   join config.usuarios u on u.user_id=uc.user_id and u.ativo and u.papel='cliente-sindico'
   where p.id=p_publicacao_id and not exists(select 1 from pcm.sso_portal_anexos_revogacoes r where r.publicacao_id=p.id)
   for share of os,n,o,b,uc,u;
 if v_caminho is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_caminho;
end; $$;
revoke all on function pcm.sso_portal_anexo_os_servico(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_portal_anexo_os_servico(uuid,uuid) to service_role;
