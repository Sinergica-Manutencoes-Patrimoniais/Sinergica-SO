-- ADR-1305: consulta autenticada de referências opacas; gate original continua fechado.
create function pcm.sso_listar_referencias_foto_campo_mediado(
  p_ator_id uuid,p_cliente_id uuid,p_lote_id uuid,p_chave text,p_apos integer,p_limite integer
) returns table(posicao integer,referencia text)
language plpgsql volatile security definer set search_path='' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_ator_id then
    raise exception 'sem_acesso' using errcode='42501';
  end if;
  return query select * from pcm.sso_listar_referencias_foto_campo(
    p_ator_id,p_cliente_id,p_lote_id,p_chave,p_apos,p_limite);
end; $$;
revoke all on function pcm.sso_listar_referencias_foto_campo_mediado(uuid,uuid,uuid,text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_referencias_foto_campo_mediado(uuid,uuid,uuid,text,integer,integer) to authenticated;
