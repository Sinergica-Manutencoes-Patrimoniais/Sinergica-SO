-- ADR-1032: preserva vínculo existente mesmo quando o gate de recepção estiver fechado.
create function pcm.sso_guardar_triagem_com_lote() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_envelope uuid;
begin
  v_envelope := case when tg_op = 'DELETE' then old.envelope_id else new.envelope_id end;
  perform 1 from pcm.origem_campo_inbox where id = v_envelope for update;
  if not found then raise exception 'envelope_indisponivel' using errcode = '23514'; end if;
  if tg_op = 'UPDATE' and new.envelope_id is distinct from old.envelope_id then
    raise exception 'mudanca_envelope_exige_reconciliacao' using errcode = '23514';
  end if;
  if exists (select 1 from pcm.sso_recepcao_envelope_campo r where r.envelope_id = v_envelope) then
    raise exception 'lote_exige_reconciliacao' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function pcm.sso_guardar_triagem_com_lote() from public, anon, authenticated, service_role;
create trigger sso_guardar_triagem_com_lote before insert or update or delete on pcm.sso_origem_campo_triagens
  for each row execute function pcm.sso_guardar_triagem_com_lote();

create function pcm.sso_guardar_resolucao_com_lote() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_lote pcm.sso_recepcao_envelope_campo%rowtype;
begin
  perform 1 from pcm.origem_campo_inbox where id = new.envelope_id for update;
  if not found then raise exception 'envelope_indisponivel' using errcode = '23514'; end if;
  select * into v_lote from pcm.sso_recepcao_envelope_campo where envelope_id = new.envelope_id;
  if found and (new.resultado is distinct from 'os_identificada'
    or new.cliente_id is distinct from v_lote.cliente_id or new.os_id is distinct from v_lote.os_id) then
    raise exception 'lote_exige_reconciliacao' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_guardar_resolucao_com_lote() from public, anon, authenticated, service_role;
create trigger sso_guardar_resolucao_com_lote before insert on pcm.origem_campo_resolucoes
  for each row execute function pcm.sso_guardar_resolucao_com_lote();
