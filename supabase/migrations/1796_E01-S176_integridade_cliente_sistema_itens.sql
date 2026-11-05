-- ADR-1654: guards aditivos, sem backfill ou alteração dos vínculos existentes.
-- Reversão operacional: restaurar versão anterior dos escritores e remover somente os novos
-- triggers/funções após inventário; jamais apagar vínculos para tornar a migration aplicável.
create function pcm.sso_integridade_cliente_sistema_item() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_sistema_cliente uuid; v_item_cliente uuid;
begin
  if tg_op='UPDATE' and new.sistema_id is not distinct from old.sistema_id
    and new.item_id is not distinct from old.item_id then return new; end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-integridade-sistema-item-cliente',0)) then
    raise exception 'vinculo_concorrente_tente_novamente' using errcode='40001'; end if;
  select s.cliente_id into v_sistema_cliente from pcm.sistemas s where s.id=new.sistema_id for share;
  if not found then raise exception 'vinculo_invalido' using errcode='23514'; end if;
  select e.client_id into v_item_cliente from pcm.equipamentos e where e.id=new.item_id for share;
  if not found or v_sistema_cliente is null or v_item_cliente is null or v_sistema_cliente is distinct from v_item_cliente then
    raise exception 'vinculo_cliente_incompativel' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function pcm.sso_integridade_cliente_sistema_item() from public,anon,authenticated,service_role;
create trigger aaa_integridade_cliente_sistema_item before insert or update of sistema_id,item_id on pcm.sistema_itens
  for each row execute function pcm.sso_integridade_cliente_sistema_item();

create function pcm.sso_integridade_cliente_sistema_item_inversa() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='sistemas' then
    if new.cliente_id is not distinct from old.cliente_id then return new; end if;
  else
    if new.client_id is not distinct from old.client_id then return new; end if;
  end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-integridade-sistema-item-cliente',0)) then
    raise exception 'vinculo_concorrente_tente_novamente' using errcode='40001'; end if;
  if tg_table_name='sistemas' then
    if exists(select 1 from pcm.sistema_itens v left join pcm.equipamentos e on e.id=v.item_id
      where v.sistema_id=old.id and (new.cliente_id is null or e.client_id is null or e.client_id is distinct from new.cliente_id)) then
      raise exception 'sistema_possui_vinculo_de_outro_cliente' using errcode='23514'; end if;
  else
    if exists(select 1 from pcm.sistema_itens v left join pcm.sistemas s on s.id=v.sistema_id
      where v.item_id=old.id and (new.client_id is null or s.cliente_id is null or s.cliente_id is distinct from new.client_id)) then
      raise exception 'item_possui_vinculo_de_outro_cliente' using errcode='23514'; end if;
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_integridade_cliente_sistema_item_inversa() from public,anon,authenticated,service_role;
create trigger aaa_integridade_cliente_sistema_inversa before update of cliente_id on pcm.sistemas
  for each row execute function pcm.sso_integridade_cliente_sistema_item_inversa();
create trigger aaa_integridade_cliente_item_inversa before update of client_id on pcm.equipamentos
  for each row execute function pcm.sso_integridade_cliente_sistema_item_inversa();
