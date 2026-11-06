-- ADR-0389: não infere encerramento pelo status legado e não permite reabertura silenciosa.
create function pcm.sso_guardar_status_chamado_encerrado() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if coalesce((select habilitado from pcm.sso_encerramento_chamado_gate where id),false) and old.sso_encerrado_em is not null
 and (new.status is distinct from old.status or new.sso_encerrado_em is null)
 and not exists(select 1 from pcm.sso_token_encerramento_chamado t where t.txid=pg_catalog.txid_current() and t.chamado_id=old.id) then
  raise exception 'chamado_encerrado_requer_reabertura_formal' using errcode='23514';
 end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_status_chamado_encerrado() from public,anon,authenticated,service_role;
create trigger sso_guardar_status_chamado_encerrado before update of status,sso_encerrado_em on pcm.chamados for each row execute function pcm.sso_guardar_status_chamado_encerrado();
