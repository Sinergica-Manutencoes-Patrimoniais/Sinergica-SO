-- E01-S176: valida pai/Cliente e ciclos sem alterar registros existentes (ADR-0031).
-- Reverso: remover trg_equipamentos_hierarquia_s176 e pcm.fn_equipamentos_hierarquia_s176();
-- a reversão volta a depender apenas da validação de aplicação.
create or replace function pcm.fn_equipamentos_hierarquia_s176()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_cliente_antigo uuid;
  v_cliente uuid;
  v_pai pcm.equipamentos%rowtype;
  v_ciclo boolean;
begin
  if tg_op = 'UPDATE' then
    if new.parent_item_id is not distinct from old.parent_item_id
      and new.client_id is not distinct from old.client_id then return new; end if;
    v_cliente_antigo := old.client_id;
  end if;

  -- Uma ordem única para Cliente antigo/novo reduz deadlocks; bloqueio dura a transação.
  for v_cliente in select distinct x from unnest(array[v_cliente_antigo, new.client_id]) x
    where x is not null order by x loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso_hierarquia:' || v_cliente::text, 0));
  end loop;

  if tg_op = 'UPDATE' and new.client_id is distinct from old.client_id and exists (
    select 1 from pcm.equipamentos f where f.parent_item_id = new.id
      and f.deleted_at is null and f.client_id is distinct from new.client_id
  ) then
    raise exception 'filhos_de_outro_cliente' using errcode = '23514';
  end if;
  if new.parent_item_id is null then return new; end if;
  if new.id = new.parent_item_id then raise exception 'autoparente_nao_permitido' using errcode = '23514'; end if;

  select * into v_pai from pcm.equipamentos where id = new.parent_item_id for share;
  if not found or not v_pai.ativo or v_pai.deleted_at is not null
    or new.client_id is null or v_pai.client_id is distinct from new.client_id then
    raise exception 'pai_invalido_ou_de_outro_cliente' using errcode = '23514';
  end if;

  with recursive ancestrais as (
    select p.id, p.parent_item_id, array[p.id] as caminho, false as repetido
      from pcm.equipamentos p where p.id = new.parent_item_id
    union all
    select p.id, p.parent_item_id, a.caminho || p.id, p.id = any(a.caminho)
      from ancestrais a join pcm.equipamentos p on p.id = a.parent_item_id
      where not a.repetido
  ) select exists (select 1 from ancestrais a where a.id = new.id or a.repetido) into v_ciclo;
  if v_ciclo then raise exception 'ciclo_na_hierarquia' using errcode = '23514'; end if;
  return new;
end;
$$;
revoke all on function pcm.fn_equipamentos_hierarquia_s176() from public, anon, authenticated, service_role;
drop trigger if exists trg_equipamentos_hierarquia_s176 on pcm.equipamentos;
create trigger trg_equipamentos_hierarquia_s176
  before insert or update of parent_item_id, client_id on pcm.equipamentos
  for each row execute function pcm.fn_equipamentos_hierarquia_s176();
