-- ADR-1245: guarda cruzada com registro privado; não disponibiliza códigos de Grupo.
create function pcm.sso_guardar_colisao_codigo_grupo()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_codigo text;
  v_anterior text;
begin
  if tg_table_name = 'equipamentos' then
    v_codigo := new.identificador;
    if tg_op = 'UPDATE' then v_anterior := old.identificador; end if;
  else
    v_codigo := new.codigo;
    if tg_op = 'UPDATE' then v_anterior := old.codigo; end if;
  end if;
  if v_codigo is null or btrim(v_codigo) = '' or
    (tg_op = 'UPDATE' and v_codigo is not distinct from v_anterior) then return new; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-codigos-publicos', 0)) then
    raise exception 'codigo_concorrente_tente_novamente' using errcode = '40001';
  end if;
  if exists (select 1 from pcm.sso_codigos_grupo_quantitativo g
    where upper(btrim(g.codigo)) = upper(btrim(v_codigo))) then
    raise exception 'codigo_publico_em_uso' using errcode = '23505';
  end if;
  return new;
end $$;
revoke all on function pcm.sso_guardar_colisao_codigo_grupo() from public, anon, authenticated, service_role;

create trigger sso_codigo_grupo_sistema_guard before insert or update of codigo on pcm.sistemas
  for each row execute function pcm.sso_guardar_colisao_codigo_grupo();
create trigger sso_codigo_grupo_componente_guard before insert or update of identificador on pcm.equipamentos
  for each row execute function pcm.sso_guardar_colisao_codigo_grupo();
create trigger sso_codigo_grupo_alias_guard before insert or update of codigo on pcm.sso_codigo_aliases
  for each row execute function pcm.sso_guardar_colisao_codigo_grupo();
create trigger sso_codigo_grupo_reserva_guard before insert or update of codigo on pcm.sso_reservas_codigo_parcial
  for each row execute function pcm.sso_guardar_colisao_codigo_grupo();
