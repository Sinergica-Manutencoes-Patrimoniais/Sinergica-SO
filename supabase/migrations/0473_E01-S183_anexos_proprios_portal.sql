-- ADR-0247: somente anexos de notas do próprio contato ativo; funções revogadas.
create function pcm.sso_portal_listar_anexos_proprios(p_cliente_id uuid, p_os_id uuid, p_apos uuid default null)
returns table(nota_id uuid, enviado_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_os_id is null
    or not exists (select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id = uc.user_id
      where uc.user_id = auth.uid() and uc.cliente_id = p_cliente_id and u.ativo and u.papel = 'cliente-sindico')
    or not exists (select 1 from pcm.ordens_servico os where os.id = p_os_id and os.client_id = p_cliente_id and os.deleted_at is null) then
    raise exception 'ordem_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  if not coalesce((select habilitado from pcm.sso_portal_anexo_gate where id), false) then raise exception 'anexos_indisponiveis' using errcode = '55000'; end if;
  return query select n.id, n.created_at from pcm.os_notas n
    join storage.objects o on o.name = n.anexo_path and o.bucket_id = 'os-anexos' and split_part(o.name, '/', 1) = p_cliente_id::text
      and o.owner_id = auth.uid()::text
    join storage.buckets b on b.id = o.bucket_id and b.public is false
    where n.cliente_id = p_cliente_id and n.ordem_servico_id = p_os_id and n.autor_tipo = 'cliente' and n.created_by = auth.uid()
      and (p_apos is null or n.id > p_apos) order by n.id limit 20;
end;
$$;
revoke all on function pcm.sso_portal_listar_anexos_proprios(uuid, uuid, uuid) from public, anon, authenticated, service_role;

create function pcm.sso_portal_anexo_proprio_autorizado(p_nota_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_caminho text;
begin
  if auth.uid() is null or p_nota_id is null or not coalesce((select habilitado from pcm.sso_portal_anexo_gate where id), false) then
    raise exception 'anexo_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  select n.anexo_path into v_caminho from pcm.os_notas n
    join pcm.ordens_servico os on os.id = n.ordem_servico_id and os.client_id = n.cliente_id and os.deleted_at is null
    join storage.objects o on o.name = n.anexo_path and o.bucket_id = 'os-anexos' and split_part(o.name, '/', 1) = n.cliente_id::text
      and o.owner_id = auth.uid()::text
    join storage.buckets b on b.id = o.bucket_id and b.public is false
    where n.id = p_nota_id and n.autor_tipo = 'cliente' and n.created_by = auth.uid()
      and exists (select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id = uc.user_id
        where uc.user_id = auth.uid() and uc.cliente_id = n.cliente_id and u.ativo and u.papel = 'cliente-sindico');
  if v_caminho is null then raise exception 'anexo_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  return v_caminho;
end;
$$;
revoke all on function pcm.sso_portal_anexo_proprio_autorizado(uuid) from public, anon, authenticated, service_role;
