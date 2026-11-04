-- ADR-0073: impedir nova composição ou confirmação com OS encerrada.
create function pcm.sso_validar_os_ativa_visita() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_status text; v_excluida timestamptz;
begin
  select o.status, o.deleted_at into v_status, v_excluida from pcm.ordens_servico o
    where o.id = new.os_id and o.client_id = new.cliente_id for share;
  if not found or v_excluida is not null or v_status in ('finalizado', 'cancelado') then
    raise exception 'os_nao_elegivel' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_validar_os_ativa_visita() from public, anon, authenticated, service_role;
create trigger sso_validar_os_ativa_visita before insert on pcm.visita_ordens_servico
for each row execute function pcm.sso_validar_os_ativa_visita();

create function pcm.sso_validar_os_antes_confirmacao() returns trigger
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
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_validar_os_antes_confirmacao() from public, anon, authenticated, service_role;
create trigger sso_visita_os_antes_confirmacao before update of estado on pcm.visitas
for each row execute function pcm.sso_validar_os_antes_confirmacao();

create or replace function pcm.sso_selecionar_os_visita(p_cliente_id uuid, p_visita_id uuid, p_busca text, p_limite integer, p_apos uuid)
returns table(id uuid, numero text, titulo text, categoria text, status text)
language plpgsql stable security definer set search_path = '' as $$
declare v_busca text := lower(btrim(coalesce(p_busca, '')));
begin
  if p_cliente_id is null or p_visita_id is null or p_limite is null or p_limite < 1 or p_limite > 100 or length(v_busca) > 120 then
    raise exception 'consulta_invalida' using errcode = '22023';
  end if;
  if not config.sso_autorizar_acao('visita.confirmar', p_cliente_id)
    or not exists (select 1 from pcm.visitas v where v.id = p_visita_id and v.cliente_id = p_cliente_id) then
    raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  return query select o.id, o.numero, o.titulo, o.categoria, o.status from pcm.ordens_servico o
    where o.client_id = p_cliente_id and o.deleted_at is null and o.status not in ('finalizado', 'cancelado')
      and (p_apos is null or o.id > p_apos)
      and (v_busca = '' or strpos(lower(o.numero), v_busca) > 0 or strpos(lower(o.titulo), v_busca) > 0)
      and not exists (select 1 from pcm.visita_ordens_servico vo where vo.os_id = o.id and vo.encerrado_em is null)
    order by o.id limit p_limite;
end;
$$;
