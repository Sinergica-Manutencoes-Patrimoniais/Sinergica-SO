-- ADR-1037: protege inclusive caminhos legados enquanto consumidores não interpretarem o novo estado.
create function pcm.sso_impedir_encerrar_com_continuacao_devolvida() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if ((old.sso_encerrado_em is null and new.sso_encerrado_em is not null)
    or (old.status is distinct from 'cancelado' and new.status='cancelado'))
    and exists(select 1 from pcm.chamado_continuacoes_propostas p
      where p.chamado_id=old.id and p.situacao='devolvida_backlog') then
    raise exception 'continuidade_devolvida_exige_reconciliacao' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_impedir_encerrar_com_continuacao_devolvida() from public,anon,authenticated,service_role;
create trigger sso_impedir_encerrar_com_continuacao_devolvida before update on pcm.chamados
  for each row execute function pcm.sso_impedir_encerrar_com_continuacao_devolvida();
