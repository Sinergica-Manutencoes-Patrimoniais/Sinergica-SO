-- ADR-0094: revalida capacidade após as esperas da composição, sem alterar contrato.
create or replace function pcm.sso_validar_os_antes_confirmacao() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_os record;
begin
  if new.estado = 'confirmada' and old.estado is distinct from new.estado then
    for v_os in select s.status, s.deleted_at from pcm.visita_ordens_servico o
      join pcm.ordens_servico s on s.id = o.os_id and s.client_id = o.cliente_id
      where o.visita_id = new.id and o.cliente_id = new.cliente_id and o.encerrado_em is null
      order by s.id for share of s loop
      if v_os.deleted_at is not null or v_os.status in ('finalizado', 'cancelado') then
        raise exception 'os_nao_elegivel' using errcode = '23514';
      end if;
    end loop;
    if not config.sso_autorizar_acao('visita.confirmar', new.cliente_id) then
      raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_validar_os_antes_confirmacao() from public, anon, authenticated, service_role;
