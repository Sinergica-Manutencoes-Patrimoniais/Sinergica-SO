-- ADR-0200: serializa fronteira; não concede execução nem ativa gates.
create or replace function pcm.sso_triagem_impedir_resolucao_automatica() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform 1 from pcm.origem_campo_inbox where id=new.envelope_id for update;
  if not found then raise exception 'envelope_indisponivel' using errcode='23514'; end if;
  if exists(select 1 from pcm.sso_origem_campo_triagens t where t.envelope_id=new.envelope_id) then
    raise exception 'triagem_exige_reconciliacao' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_triagem_impedir_resolucao_automatica() from public,anon,authenticated,service_role;
