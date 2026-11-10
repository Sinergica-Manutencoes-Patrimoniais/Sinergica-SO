-- ADR-0098: trava transacional compartilhada apenas para confirmação de Visita.
create function config.sso_serializar_fonte_autorizacao() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0));
  return null;
end;
$$;
revoke all on function config.sso_serializar_fonte_autorizacao() from public, anon, authenticated, service_role;

create trigger sso_serializar_autorizacao before insert or update or delete or truncate on config.sso_concessoes for each statement execute function config.sso_serializar_fonte_autorizacao();
create trigger sso_serializar_autorizacao before insert or update or delete or truncate on config.sso_usuario_perfis for each statement execute function config.sso_serializar_fonte_autorizacao();
create trigger sso_serializar_autorizacao before insert or update or delete or truncate on config.sso_perfis for each statement execute function config.sso_serializar_fonte_autorizacao();
create trigger sso_serializar_autorizacao before insert or update or delete or truncate on config.sso_acoes for each statement execute function config.sso_serializar_fonte_autorizacao();
create trigger sso_serializar_autorizacao before insert or update or delete or truncate on config.sso_acao_modulos for each statement execute function config.sso_serializar_fonte_autorizacao();
create trigger sso_serializar_autorizacao before insert or update or delete or truncate on config.usuarios for each statement execute function config.sso_serializar_fonte_autorizacao();
create trigger sso_serializar_autorizacao before insert or update or delete or truncate on config.usuario_modulos for each statement execute function config.sso_serializar_fonte_autorizacao();
create trigger sso_serializar_autorizacao before insert or update or delete or truncate on config.grupos for each statement execute function config.sso_serializar_fonte_autorizacao();
create trigger sso_serializar_autorizacao before insert or update or delete or truncate on config.grupo_modulos for each statement execute function config.sso_serializar_fonte_autorizacao();
create trigger sso_serializar_autorizacao before insert or update or delete or truncate on pcm.clientes for each statement execute function config.sso_serializar_fonte_autorizacao();

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
    if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then
      raise exception 'autorizacao_em_alteracao' using errcode = '55P03';
    end if;
    if not config.sso_autorizar_acao('visita.confirmar', new.cliente_id) then
      raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_validar_os_antes_confirmacao() from public, anon, authenticated, service_role;
