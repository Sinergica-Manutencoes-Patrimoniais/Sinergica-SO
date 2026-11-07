-- Mantém Cliente coerente mesmo quando cadastros existentes são alterados fora da RPC.
create function pcm.sso_validar_vinculos_grupo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_cliente uuid;
begin
  select a.cliente_id into v_cliente from pcm.locais l join pcm.areas a on a.id = l.area_id
    where l.id = new.local_id for share of l, a;
  if v_cliente is distinct from new.cliente_id then
    raise exception 'local_de_outro_cliente' using errcode = '23514';
  end if;
  if new.sistema_id is not null then
    select s.cliente_id into v_cliente from pcm.sistemas s where s.id = new.sistema_id for share;
    if v_cliente is distinct from new.cliente_id then
      raise exception 'sistema_de_outro_cliente' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger sso_grupo_vinculos before insert or update of cliente_id, local_id, sistema_id
on pcm.grupos_quantitativos for each row execute function pcm.sso_validar_vinculos_grupo();

create function pcm.sso_proteger_cliente_grupos() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_cliente uuid;
begin
  if tg_table_name = 'locais' then
    select a.cliente_id into v_cliente from pcm.areas a where a.id = new.area_id for share;
    if exists (select 1 from pcm.grupos_quantitativos g where g.local_id = old.id and g.cliente_id is distinct from v_cliente) then
      raise exception 'local_com_grupo_de_outro_cliente' using errcode = '23514';
    end if;
  elsif tg_table_name = 'areas' then
    if exists (select 1 from pcm.grupos_quantitativos g join pcm.locais l on l.id = g.local_id
      where l.area_id = old.id and g.cliente_id is distinct from new.cliente_id) then
      raise exception 'area_com_grupo_de_outro_cliente' using errcode = '23514';
    end if;
  elsif tg_table_name = 'sistemas' then
    if exists (select 1 from pcm.grupos_quantitativos g
      where g.sistema_id = old.id and g.cliente_id is distinct from new.cliente_id) then
      raise exception 'sistema_com_grupo_de_outro_cliente' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger sso_local_proteger_grupos before update of area_id on pcm.locais
for each row when (old.area_id is distinct from new.area_id) execute function pcm.sso_proteger_cliente_grupos();
create trigger sso_area_proteger_grupos before update of cliente_id on pcm.areas
for each row when (old.cliente_id is distinct from new.cliente_id) execute function pcm.sso_proteger_cliente_grupos();
create trigger sso_sistema_proteger_grupos before update of cliente_id on pcm.sistemas
for each row when (old.cliente_id is distinct from new.cliente_id) execute function pcm.sso_proteger_cliente_grupos();
