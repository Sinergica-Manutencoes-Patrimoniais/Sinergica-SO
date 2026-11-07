-- ADR-1205: entrada de leitura, sem conceder acesso ao núcleo privado.
create function pcm.sso_listar_reservas_equipment_mediada(p_ator_id uuid, p_cliente_id uuid, p_apos uuid, p_limite integer)
returns table(outbox_id uuid, componente_id uuid, nome text, status_local text, criado_em timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_ator_id is distinct from auth.uid() or p_cliente_id is null
    or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03';
  end if;
  if config.sso_autorizar_acao('cadastro.gerir', p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode = '42501'; end if;
  return query select * from pcm.sso_listar_reservas_equipment(p_ator_id, p_cliente_id, p_apos, p_limite);
end; $$;
revoke all on function pcm.sso_listar_reservas_equipment_mediada(uuid,uuid,uuid,integer) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_listar_reservas_equipment_mediada(uuid,uuid,uuid,integer) to authenticated;
