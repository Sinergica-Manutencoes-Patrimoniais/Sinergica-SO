-- ADR-0736: guarda sequencial opt-in. Não resolve a concorrência Grupo/retorno.
create function pcm.sso_guardar_vinculo_grupo_retorno_preexistente()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce((select habilitado from pcm.sso_vinculo_os_grupo_gate where id), false) then
    return new;
  end if;
  if exists (select 1 from pcm.retorno_os_preparado r where r.os_id = new.os_id)
    or exists (select 1 from pcm.sso_pendencias_tecnicas p where p.os_id = new.os_id) then
    raise exception 'os_com_retorno_exige_reconciliacao' using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_guardar_vinculo_grupo_retorno_preexistente() from public, anon, authenticated, service_role;
create trigger sso_guardar_vinculo_grupo_retorno_preexistente
  before insert on pcm.sso_vinculos_os_grupo
  for each row execute function pcm.sso_guardar_vinculo_grupo_retorno_preexistente();
