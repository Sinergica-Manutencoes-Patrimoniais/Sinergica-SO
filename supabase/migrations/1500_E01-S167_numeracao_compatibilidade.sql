-- ADR-1352: função preparada mas não instalada; trigger legada continua ativa.
create function pcm.sso_numero_os_chamado_compativel() returns trigger
language plpgsql volatile security definer set search_path = '' as $$
declare v_numero text; v_habilitada boolean;
begin
  if new.chamado_id is null then
    if new.numero is null then new.numero := 'PRE-' || upper(substr(new.id::text, 1, 8)); end if;
    return new;
  end if;
  select numero into v_numero from pcm.chamados where id = new.chamado_id;
  if v_numero is null then raise exception 'Chamado % não encontrado para vincular a OS', new.chamado_id; end if;
  select habilitado into v_habilitada from pcm.sso_guarda_multiplas_os_gate where id for share;
  if coalesce(v_habilitada, false) and exists (
    select 1 from pcm.sso_guarda_multiplas_os_tokens t
    where t.txid = pg_catalog.txid_current() and t.ator_id = auth.uid() and t.chamado_id = new.chamado_id
      and t.cliente_id = new.client_id and t.os_id = new.id
  ) then
    if new.id is null then raise exception 'os_sem_identidade' using errcode = '22023'; end if;
    new.numero := v_numero || '-OS-' || new.id::text;
  else
    new.numero := v_numero;
  end if;
  return new;
end; $$;
revoke all on function pcm.sso_numero_os_chamado_compativel() from public, anon, authenticated, service_role;
