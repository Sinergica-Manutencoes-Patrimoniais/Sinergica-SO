-- ADR-0245: proteção aditiva. Default false mantém leitura legada até rollout coordenado.
create table pcm.sso_bloqueio_anexo_direto_gate (id boolean primary key default true check (id), habilitado boolean not null default false);
alter table pcm.sso_bloqueio_anexo_direto_gate enable row level security;
alter table pcm.sso_bloqueio_anexo_direto_gate force row level security;
revoke all on pcm.sso_bloqueio_anexo_direto_gate from public, anon, authenticated, service_role;
insert into pcm.sso_bloqueio_anexo_direto_gate(id, habilitado) values (true, false);

create function pcm.sso_leitura_direta_anexo_os_permitida()
returns boolean language sql stable security definer set search_path = '' as $$
  select not coalesce((select g.habilitado from pcm.sso_bloqueio_anexo_direto_gate g where g.id), false)
    or (auth.uid() is not null and config.s184_acesso_interno_atual('pcm') is true);
$$;
revoke all on function pcm.sso_leitura_direta_anexo_os_permitida() from public, anon, service_role;
-- A policy precisa de EXECUTE para avaliar a própria sessão; não revela caminho ou objeto.
grant execute on function pcm.sso_leitura_direta_anexo_os_permitida() to authenticated;
create policy s183_anexo_os_somente_rota on storage.objects as restrictive for select to authenticated
  using (bucket_id <> 'os-anexos' or pcm.sso_leitura_direta_anexo_os_permitida());

-- Prévia limitada às notas de OS: não inventaria outros usos do bucket nem URLs emitidas.
create function pcm.sso_inventario_anexos_os(p_cliente_id uuid)
returns table(notas_com_anexo bigint, sem_objeto bigint, sem_publicacao_ativa bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('anexo_os.publicar', p_cliente_id) is not true then
    raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  return query select count(*), count(*) filter (where not exists (select 1 from storage.objects o
      join storage.buckets b on b.id = o.bucket_id and b.public is false
      where o.bucket_id = 'os-anexos' and o.name = n.anexo_path and split_part(o.name, '/', 1) = n.cliente_id::text)),
    count(*) filter (where not exists (select 1 from pcm.sso_portal_anexos_publicacoes p
      join storage.objects o on o.id = p.objeto_id and o.bucket_id = 'os-anexos' and o.name = p.caminho
        and o.metadata is not distinct from p.metadata_snapshot and o.updated_at is not distinct from p.objeto_updated_at
      join storage.buckets b on b.id = o.bucket_id and b.public is false
      where p.nota_id = n.id and p.cliente_id = n.cliente_id and p.ordem_servico_id = n.ordem_servico_id
        and not exists (select 1 from pcm.sso_portal_anexos_revogacoes r where r.publicacao_id = p.id)))
    from pcm.os_notas n join pcm.ordens_servico os on os.id = n.ordem_servico_id and os.client_id = n.cliente_id and os.deleted_at is null
    where n.cliente_id = p_cliente_id and n.anexo_path is not null;
end;
$$;
revoke all on function pcm.sso_inventario_anexos_os(uuid) from public, anon, authenticated, service_role;
