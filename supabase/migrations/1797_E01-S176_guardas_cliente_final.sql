-- ADR-1655: cobre alterações indiretas após normalização sem modificar dados legados.
create or replace function pcm.fn_equipamentos_hierarquia_s176()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_cliente_antigo uuid; v_cliente uuid; v_pai pcm.equipamentos%rowtype; v_ciclo boolean;
begin
  if tg_op='INSERT' and new.parent_item_id is null then return new; end if;
  if tg_op = 'UPDATE' then
    if new.parent_item_id is not distinct from old.parent_item_id
      and new.client_id is not distinct from old.client_id then return new; end if;
    v_cliente_antigo := old.client_id;
  end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  for v_cliente in select distinct x from unnest(array[v_cliente_antigo,new.client_id]) x where x is not null order by x loop
    if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso_hierarquia:'||v_cliente::text,0)) then
      raise exception 'hierarquia_concorrente_tente_novamente' using errcode='40001'; end if;
  end loop;
  if tg_op='UPDATE' and new.client_id is distinct from old.client_id and exists (
    select 1 from pcm.equipamentos f where f.parent_item_id=new.id and f.deleted_at is null and f.client_id is distinct from new.client_id
  ) then raise exception 'filhos_de_outro_cliente' using errcode='23514'; end if;
  if new.parent_item_id is null then return new; end if;
  if new.id=new.parent_item_id then raise exception 'autoparente_nao_permitido' using errcode='23514'; end if;
  select * into v_pai from pcm.equipamentos where id=new.parent_item_id for share;
  if not found or not v_pai.ativo or v_pai.deleted_at is not null or new.client_id is null or v_pai.client_id is distinct from new.client_id then
    raise exception 'pai_invalido_ou_de_outro_cliente' using errcode='23514'; end if;
  with recursive ancestrais as (
    select p.id,p.parent_item_id,array[p.id] as caminho,false as repetido from pcm.equipamentos p where p.id=new.parent_item_id
    union all
    select p.id,p.parent_item_id,a.caminho||p.id,p.id=any(a.caminho)
      from ancestrais a join pcm.equipamentos p on p.id=a.parent_item_id where not a.repetido
  ) select exists(select 1 from ancestrais a where a.id=new.id or a.repetido) into v_ciclo;
  if v_ciclo then raise exception 'ciclo_na_hierarquia' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function pcm.fn_equipamentos_hierarquia_s176() from public,anon,authenticated,service_role;
drop trigger trg_equipamentos_zz_hierarquia_s176 on pcm.equipamentos;
create trigger trg_equipamentos_zz_hierarquia_s176 before insert or update on pcm.equipamentos
  for each row execute function pcm.fn_equipamentos_hierarquia_s176();

-- AFTER observa o Cliente final, incluindo mudanças de BEFORE triggers da normalização.
drop trigger aaa_integridade_cliente_sistema_inversa on pcm.sistemas;
drop trigger aaa_integridade_cliente_item_inversa on pcm.equipamentos;
create trigger sso_integridade_cliente_sistema_final after update on pcm.sistemas
  for each row when (old.cliente_id is distinct from new.cliente_id)
  execute function pcm.sso_integridade_cliente_sistema_item_inversa();
create trigger sso_integridade_cliente_item_final after update on pcm.equipamentos
  for each row when (old.client_id is distinct from new.client_id)
  execute function pcm.sso_integridade_cliente_sistema_item_inversa();

create trigger sso_equipamento_cliente_final_rotina after update on pcm.equipamentos
  for each row when (old.client_id is distinct from new.client_id)
  execute function pcm.sso_proteger_cliente_alvo_rotina();
create trigger sso_sistema_cliente_final_rotina after update on pcm.sistemas
  for each row when (old.cliente_id is distinct from new.cliente_id)
  execute function pcm.sso_proteger_cliente_alvo_rotina();
create trigger sso_sistema_cliente_final_grupos after update on pcm.sistemas
  for each row when (old.cliente_id is distinct from new.cliente_id)
  execute function pcm.sso_proteger_cliente_grupos();
create trigger sso_equipamento_cliente_final_codigo after update on pcm.equipamentos
  for each row when (old.client_id is distinct from new.client_id)
  execute function pcm.sso_guardar_codigo_publico();
create trigger sso_sistema_cliente_final_codigo after update on pcm.sistemas
  for each row when (old.cliente_id is distinct from new.cliente_id)
  execute function pcm.sso_guardar_codigo_publico();
