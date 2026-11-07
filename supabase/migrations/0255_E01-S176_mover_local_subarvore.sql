-- ADR-0036: manter posição redundante coerente na mesma transação da mudança de Área.
create function pcm.sso_propagar_area_do_local() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update pcm.locais set area_id = new.area_id where parent_id = new.id and area_id is distinct from new.area_id;
  update pcm.equipamentos set area_id = new.area_id where local_id = new.id and area_id is distinct from new.area_id;
  update pcm.sistemas set area_id = new.area_id where local_id = new.id and area_id is distinct from new.area_id;
  return new;
end;
$$;
revoke all on function pcm.sso_propagar_area_do_local() from public, anon, authenticated, service_role;
create trigger sso_propagar_area_do_local after update of area_id on pcm.locais
for each row when (old.area_id is distinct from new.area_id) execute function pcm.sso_propagar_area_do_local();
