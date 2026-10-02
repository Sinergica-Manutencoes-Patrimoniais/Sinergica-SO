-- E01-S53: auditoria append-only para decisões e mudanças de preventivas.
-- Reverso: remover triggers `trg_auditar_*_preventivas` e função
-- `pcm.fn_auditar_preventivas()`; eventos já gravados em audit.events são histórico e não devem
-- ser apagados.

create or replace function pcm.fn_auditar_preventivas()
returns trigger
language plpgsql
security definer
set search_path = pcm, audit, public
as $$
declare
  v_linha jsonb;
  v_actor uuid;
  v_id uuid;
begin
  if tg_op = 'DELETE' then
    v_linha := to_jsonb(old);
    v_actor := auth.uid();
    v_id := old.id;
    insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_actor, lower(tg_op), 'pcm.' || tg_table_name, v_id, jsonb_build_object('linha', v_linha));
    return old;
  else
    v_linha := to_jsonb(new);
    v_actor := auth.uid();
    v_id := new.id;
  end if;

  insert into audit.events(actor_id, action, entity, entity_id, payload)
  values (
    v_actor,
    lower(tg_op),
    'pcm.' || tg_table_name,
    v_id,
    jsonb_build_object('linha', v_linha)
  );
  return new;
end;
$$;

create trigger trg_auditar_planos_preventivos
after insert or update or delete on pcm.planos_preventivos
for each row execute function pcm.fn_auditar_preventivas();

create trigger trg_auditar_ocorrencias_preventivas
after insert or update or delete on pcm.ocorrencias_preventivas
for each row execute function pcm.fn_auditar_preventivas();

create trigger trg_auditar_avaliacoes_preventivas
after insert or update or delete on pcm.avaliacoes_preventivas
for each row execute function pcm.fn_auditar_preventivas();

create trigger trg_auditar_achados_preventivos
after insert or update or delete on pcm.achados_preventivos
for each row execute function pcm.fn_auditar_preventivas();

revoke all on function pcm.fn_auditar_preventivas() from public;
grant execute on function pcm.fn_auditar_preventivas() to service_role;
