-- ADR-0985: proteção conservadora da proposta referenciada por retorno parcial.
create function pcm.sso_proteger_continuacao_devolvida() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from pcm.sso_retornos_parciais r where r.proposta_id=old.id and r.chamado_id=old.chamado_id) then
    raise exception 'continuacao_transferida_ao_backlog' using errcode='23514';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end; $$;
revoke all on function pcm.sso_proteger_continuacao_devolvida() from public,anon,authenticated,service_role;
create trigger sso_proteger_continuacao_devolvida before update or delete on pcm.chamado_continuacoes_propostas
for each row execute function pcm.sso_proteger_continuacao_devolvida();
