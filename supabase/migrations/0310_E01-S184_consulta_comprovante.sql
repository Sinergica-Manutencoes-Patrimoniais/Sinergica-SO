-- ADR-0086: referência vinculada e autorização atual, sem URL assinada.
create function financeiro.sso_comprovante_autorizado(p_lancamento_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_caminho text;
begin
  if p_lancamento_id is null or not config.s184_acesso_interno_atual('financeiro') then
    raise exception 'comprovante_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  select l.comprovante_path into v_caminho from financeiro.lancamentos l
    where l.id = p_lancamento_id and nullif(pg_catalog.btrim(l.comprovante_path), '') is not null
      and exists (select 1 from storage.objects o where o.bucket_id = 'financeiro-comprovantes' and o.name = l.comprovante_path);
  if not found then raise exception 'comprovante_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  return v_caminho;
end;
$$;
revoke all on function financeiro.sso_comprovante_autorizado(uuid) from public, anon;
grant execute on function financeiro.sso_comprovante_autorizado(uuid) to authenticated;
