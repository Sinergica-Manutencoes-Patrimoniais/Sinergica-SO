-- ADR-0141: leitura exclusivamente intermediada; sem grant até o rollout revisado.
create function pcm.sso_comprovante_despesa_autorizado(p_despesa_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_caminho text;
begin
  if auth.uid() is null or p_despesa_id is null then
    raise exception 'comprovante_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  select r.comprovante_caminho into v_caminho
    from pcm.despesas_visita d
    join pcm.despesa_visita_realizacoes r on r.despesa_id = d.id
    join storage.objects o on o.id = r.comprovante_objeto_id and o.name = r.comprovante_caminho
    join storage.buckets b on b.id = o.bucket_id and b.public is false
    where d.id = p_despesa_id and o.bucket_id = 'sso-despesas-visita'
      and config.sso_autorizar_acao('despesa_visita.gerir', d.cliente_id) is true;
  if v_caminho is null then
    raise exception 'comprovante_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  return v_caminho;
end;
$$;
revoke all on function pcm.sso_comprovante_despesa_autorizado(uuid)
  from public, anon, authenticated, service_role;
