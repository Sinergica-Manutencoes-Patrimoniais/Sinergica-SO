-- ADR-0035: executar hierarquia depois da normalização que deriva Cliente do Local.
alter trigger trg_equipamentos_hierarquia_s176 on pcm.equipamentos rename to trg_equipamentos_zz_hierarquia_s176;

create function pcm.sso_validar_posicao_fisica() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_area uuid; v_cliente uuid; v_cliente_item uuid;
begin
  if tg_table_name = 'equipamentos' then v_cliente_item := new.client_id;
  else v_cliente_item := new.cliente_id; end if;
  if new.local_id is not null then
    select l.area_id into v_area from pcm.locais l where l.id = new.local_id for share;
    if v_area is distinct from new.area_id then
      raise exception 'local_area_divergente' using errcode = '23514';
    end if;
  end if;
  if new.area_id is not null then
    select a.cliente_id into v_cliente from pcm.areas a where a.id = new.area_id for share;
    if v_cliente is distinct from v_cliente_item then
      raise exception 'posicao_cliente_divergente' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger zzz_equipamentos_posicao_s176 before insert or update of client_id, area_id, local_id on pcm.equipamentos
for each row execute function pcm.sso_validar_posicao_fisica();
create trigger zzz_sistemas_posicao_s176 before insert or update of cliente_id, area_id, local_id on pcm.sistemas
for each row execute function pcm.sso_validar_posicao_fisica();

create function pcm.sso_proteger_posicao_fisica() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_cliente uuid;
begin
  if tg_table_name = 'locais' then
    select a.cliente_id into v_cliente from pcm.areas a where a.id = new.area_id for share;
    if exists (select 1 from pcm.equipamentos e where e.local_id = old.id and e.client_id is not null and e.client_id is distinct from v_cliente)
      or exists (select 1 from pcm.sistemas s where s.local_id = old.id and s.cliente_id is not null and s.cliente_id is distinct from v_cliente) then
      raise exception 'local_com_ativos_de_outro_cliente' using errcode = '23514';
    end if;
  else
    if exists (select 1 from pcm.equipamentos e where e.area_id = old.id and e.client_id is not null and e.client_id is distinct from new.cliente_id)
      or exists (select 1 from pcm.sistemas s where s.area_id = old.id and s.cliente_id is not null and s.cliente_id is distinct from new.cliente_id) then
      raise exception 'area_com_ativos_de_outro_cliente' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger zzz_local_posicao_s176 before update of area_id on pcm.locais
for each row when (old.area_id is distinct from new.area_id) execute function pcm.sso_proteger_posicao_fisica();
create trigger zzz_area_posicao_s176 before update of cliente_id on pcm.areas
for each row when (old.cliente_id is distinct from new.cliente_id) execute function pcm.sso_proteger_posicao_fisica();
revoke all on function pcm.sso_validar_posicao_fisica() from public, anon, authenticated, service_role;
revoke all on function pcm.sso_proteger_posicao_fisica() from public, anon, authenticated, service_role;
