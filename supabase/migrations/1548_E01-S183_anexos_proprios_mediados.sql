-- ADR-1404: anexo próprio não vira publicação compartilhada.
create table pcm.sso_portal_anexos_proprios_mediados_gate(id boolean primary key default true check(id),leitura boolean not null default false,download boolean not null default false);
insert into pcm.sso_portal_anexos_proprios_mediados_gate(id,leitura,download) values(true,false,false);
alter table pcm.sso_portal_anexos_proprios_mediados_gate enable row level security;
alter table pcm.sso_portal_anexos_proprios_mediados_gate force row level security;
revoke all on pcm.sso_portal_anexos_proprios_mediados_gate from public,anon,authenticated,service_role;

create function pcm.sso_portal_anexos_proprios_mediado(p_ator_id uuid,p_cliente_id uuid,p_os_id uuid,p_apos uuid)
returns table(nota_id uuid,enviado_em timestamptz) language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_portal_anexos_proprios_mediados_gate where id and leitura for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_portal_anexo_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_os_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from config.usuario_cliente uc join config.usuarios u on u.user_id=uc.user_id where uc.user_id=p_ator_id and uc.cliente_id=p_cliente_id and u.ativo and u.papel='cliente-sindico' for share of uc,u;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.ordens_servico where pcm.ordens_servico.id=p_os_id and client_id=p_cliente_id and deleted_at is null for share;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select * from pcm.sso_portal_listar_anexos_proprios(p_cliente_id,p_os_id,p_apos);
end; $$;
revoke all on function pcm.sso_portal_anexos_proprios_mediado(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_portal_anexos_proprios_mediado(uuid,uuid,uuid,uuid) to authenticated;

create function pcm.sso_portal_anexo_proprio_servico(p_usuario_id uuid,p_nota_id uuid) returns text
language plpgsql volatile security definer set search_path='' as $$
declare v_caminho text;
begin
 if current_setting('transaction_isolation')<>'read committed' or coalesce(auth.role(),'')<>'service_role' or p_usuario_id is null or p_nota_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_portal_anexos_proprios_mediados_gate where id and download for share;
 if not found then raise exception 'download_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_portal_anexo_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 select n.anexo_path into v_caminho from pcm.os_notas n
   join pcm.ordens_servico os on os.id=n.ordem_servico_id and os.client_id=n.cliente_id and os.deleted_at is null
   join storage.objects o on o.name=n.anexo_path and o.bucket_id='os-anexos' and split_part(o.name,'/',1)=n.cliente_id::text and o.owner_id=p_usuario_id::text
   join storage.buckets b on b.id=o.bucket_id and b.public is false
   join config.usuario_cliente uc on uc.cliente_id=n.cliente_id and uc.user_id=p_usuario_id
   join config.usuarios u on u.user_id=uc.user_id and u.ativo and u.papel='cliente-sindico'
   where n.id=p_nota_id and n.autor_tipo='cliente' and n.created_by=p_usuario_id for share of n,os,o,b,uc,u;
 if v_caminho is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_caminho;
end; $$;
revoke all on function pcm.sso_portal_anexo_proprio_servico(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_portal_anexo_proprio_servico(uuid,uuid) to service_role;
