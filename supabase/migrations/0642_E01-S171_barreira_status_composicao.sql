-- ADR-0416: fail-closed parcial; sem adquirir locks inversos, gate desativado.
create function pcm.sso_bloquear_status_os_composicao()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.visita_composicao_conferencia_gate where id),false) then return new; end if;
  if (new.status is distinct from old.status or new.deleted_at is distinct from old.deleted_at)
    and exists(select 1 from pcm.visita_ordens_servico where os_id=old.id and encerrado_em is null) then
    raise exception 'status_os_tem_visita_ativa_protocolo_indisponivel' using errcode='55000';
  end if;
  return new;
end $$;
revoke all on function pcm.sso_bloquear_status_os_composicao() from public,anon,authenticated,service_role;
create trigger sso_barreira_status_os_composicao before update on pcm.ordens_servico for each row execute function pcm.sso_bloquear_status_os_composicao();

create function pcm.sso_bloquear_status_funcionario_composicao()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.visita_composicao_conferencia_gate where id),false) then return new; end if;
  if (new.ativo is distinct from old.ativo or new.deleted_at is distinct from old.deleted_at)
    and exists(select 1 from pcm.visita_equipes where funcionario_id=old.id and encerrado_em is null) then
    raise exception 'status_funcionario_tem_visita_ativa_protocolo_indisponivel' using errcode='55000';
  end if;
  return new;
end $$;
revoke all on function pcm.sso_bloquear_status_funcionario_composicao() from public,anon,authenticated,service_role;
create trigger sso_barreira_status_funcionario_composicao before update on pcm.funcionarios for each row execute function pcm.sso_bloquear_status_funcionario_composicao();
