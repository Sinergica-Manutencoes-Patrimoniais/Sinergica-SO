-- ADR-0048: preservar conteúdo e identidade de versão aprovada, inclusive contra escrita privilegiada.
create function pcm.sso_proteger_versao_aprovada() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.estado = 'aprovado' then
    if tg_op = 'DELETE' then
      raise exception 'versao_aprovada_imutavel' using errcode = '23514';
    end if;
    -- Fechamento futuro da vigência não altera o conteúdo aprovado.
    if (to_jsonb(new) - 'vigencia_fim') is distinct from (to_jsonb(old) - 'vigencia_fim') then
      raise exception 'versao_aprovada_imutavel' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function pcm.sso_proteger_versao_aprovada() from public, anon, authenticated, service_role;
create trigger sso_proteger_versao_aprovada before update or delete on pcm.plano_versoes
for each row execute function pcm.sso_proteger_versao_aprovada();
