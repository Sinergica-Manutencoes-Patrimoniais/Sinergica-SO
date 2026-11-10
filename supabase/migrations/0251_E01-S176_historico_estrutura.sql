-- ADR-0033: eventos de estrutura futuros, transacionais e sem dados técnicos desnecessários.
create function pcm.sso_auditar_estrutura_equipamento() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if row(old.client_id, old.area_id, old.local_id, old.parent_item_id, old.ativo, old.deleted_at)
     is distinct from row(new.client_id, new.area_id, new.local_id, new.parent_item_id, new.ativo, new.deleted_at) then
    insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'estrutura.movimentada', 'equipamentos', new.id,
      jsonb_build_object(
        'antes', jsonb_build_object('cliente_id', old.client_id, 'area_id', old.area_id,
          'local_id', old.local_id, 'parent_item_id', old.parent_item_id, 'ativo', old.ativo, 'deleted_at', old.deleted_at),
        'depois', jsonb_build_object('cliente_id', new.client_id, 'area_id', new.area_id,
          'local_id', new.local_id, 'parent_item_id', new.parent_item_id, 'ativo', new.ativo, 'deleted_at', new.deleted_at)));
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_auditar_estrutura_equipamento() from public, anon, authenticated, service_role;
create trigger sso_equipamento_historico after update of client_id, area_id, local_id, parent_item_id, ativo, deleted_at
on pcm.equipamentos for each row execute function pcm.sso_auditar_estrutura_equipamento();
