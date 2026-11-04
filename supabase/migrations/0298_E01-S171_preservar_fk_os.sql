-- Mantém erro de chave composta para OS inexistente ou de outro Cliente.
create or replace function pcm.sso_validar_os_ativa_visita() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_status text; v_excluida timestamptz;
begin
  select o.status, o.deleted_at into v_status, v_excluida from pcm.ordens_servico o
    where o.id = new.os_id and o.client_id = new.cliente_id for share;
  if not found then return new; end if;
  if v_excluida is not null or v_status in ('finalizado', 'cancelado') then
    raise exception 'os_nao_elegivel' using errcode = '23514';
  end if;
  return new;
end;
$$;
