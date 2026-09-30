-- 0223_E01-S158_descricao_completa_auvo.sql
-- Descrição de saída para o Auvo: calcula somente em writes/renames futuros. Não há backfill,
-- pois atualizar o inventário existente enfilejaria PATCHs em massa para o Auvo.
--
-- Reverso:
--   drop trigger if exists trg_sistemas_texto_auvo on pcm.sistemas;
--   drop trigger if exists trg_equipamentos_texto_auvo on pcm.equipamentos;
--   drop function if exists pcm.fn_sistemas_texto_auvo();
--   drop function if exists pcm.fn_equipamentos_texto_auvo();
--   drop function if exists pcm.fn_montar_descricao_auvo(uuid, uuid, uuid, uuid, text);
--   alter table pcm.sistemas drop column if exists auvo_descricao;
--   alter table pcm.equipamentos drop column if exists auvo_descricao;

alter table pcm.equipamentos add column if not exists auvo_descricao text;
alter table pcm.sistemas add column if not exists auvo_descricao text;

comment on column pcm.equipamentos.auvo_descricao is
  'E01-S158: descrição completa enviada ao Auvo; calculada no write, sem backfill.';
comment on column pcm.sistemas.auvo_descricao is
  'E01-S158: descrição completa enviada ao Auvo; calculada no write, sem backfill.';

create or replace function pcm.fn_montar_descricao_auvo(
  p_cliente_id uuid,
  p_area_id uuid,
  p_local_id uuid,
  p_categoria_id uuid,
  p_nome text
)
returns text
language plpgsql
stable
set search_path = pcm, public
as $$
declare
  v_cliente_nome text;
  v_area_id uuid;
  v_area_nome text;
  v_locais_nomes text[];
  v_categoria_nome text;
  v_partes text[];
begin
  select nome into v_cliente_nome from pcm.clientes where id = p_cliente_id;
  select area_id into v_area_id from pcm.locais where id = p_local_id;
  v_area_id := coalesce(v_area_id, p_area_id);
  select nome into v_area_nome from pcm.areas where id = v_area_id;

  if p_local_id is not null then
    with recursive cadeia as (
      select id, parent_id, nome, 0 as profundidade
        from pcm.locais where id = p_local_id
      union all
      select l.id, l.parent_id, l.nome, c.profundidade + 1
        from pcm.locais l join cadeia c on l.id = c.parent_id
    )
    select array_agg(nome order by profundidade desc) into v_locais_nomes from cadeia;
  end if;

  select nome into v_categoria_nome from pcm.equipamento_categorias where id = p_categoria_id;
  v_partes := array_remove(
    array[v_cliente_nome, v_area_nome] || coalesce(v_locais_nomes, array[]::text[]) ||
      array[v_categoria_nome, p_nome],
    null
  );
  return array_to_string(v_partes, ' - ');
end;
$$;

create or replace function pcm.fn_equipamentos_texto_auvo()
returns trigger
language plpgsql
as $$
begin
  new.auvo_descricao := pcm.fn_montar_descricao_auvo(
    new.client_id, new.area_id, new.local_id, new.categoria_id, new.nome
  );
  return new;
end;
$$;

create or replace function pcm.fn_sistemas_texto_auvo()
returns trigger
language plpgsql
as $$
begin
  new.auvo_descricao := pcm.fn_montar_descricao_auvo(
    new.cliente_id, new.area_id, new.local_id, new.categoria_id, new.nome
  );
  return new;
end;
$$;

create trigger trg_equipamentos_texto_auvo
  before insert or update of nome, client_id, area_id, local_id, categoria_id on pcm.equipamentos
  for each row execute function pcm.fn_equipamentos_texto_auvo();

create trigger trg_sistemas_texto_auvo
  before insert or update of nome, cliente_id, area_id, local_id, categoria_id on pcm.sistemas
  for each row execute function pcm.fn_sistemas_texto_auvo();

-- Mantém o alcance da S155: renomear Área/Local atualiza apenas os ativos afetados e o outbox
-- normal cuida dos PATCHs individuais. Cliente e categoria não propagam por decisão de escopo.
create or replace function pcm.fn_areas_propagar_localizacao()
returns trigger
language plpgsql
as $$
begin
  if new.nome is distinct from old.nome then
    update pcm.equipamentos
      set auvo_localizacao = coalesce(
            pcm.fn_montar_localizacao_hierarquica(local_id),
            pcm.fn_montar_localizacao_area(area_id)
          ),
          auvo_descricao = pcm.fn_montar_descricao_auvo(
            client_id, area_id, local_id, categoria_id, nome
          )
      where area_id = new.id
         or local_id in (select id from pcm.locais where area_id = new.id);

    update pcm.sistemas
      set auvo_localizacao = coalesce(
            pcm.fn_montar_localizacao_hierarquica(local_id),
            pcm.fn_montar_localizacao_area(area_id)
          ),
          auvo_descricao = pcm.fn_montar_descricao_auvo(
            cliente_id, area_id, local_id, categoria_id, nome
          )
      where area_id = new.id
         or local_id in (select id from pcm.locais where area_id = new.id);
  end if;
  return new;
end;
$$;

create or replace function pcm.fn_locais_propagar_localizacao()
returns trigger
language plpgsql
as $$
begin
  if new.nome is distinct from old.nome then
    with recursive descendentes as (
      select id from pcm.locais where id = new.id
      union all
      select l.id from pcm.locais l join descendentes d on l.parent_id = d.id
    )
    update pcm.equipamentos
      set auvo_localizacao = pcm.fn_montar_localizacao_hierarquica(local_id),
          auvo_descricao = pcm.fn_montar_descricao_auvo(
            client_id, area_id, local_id, categoria_id, nome
          )
      where local_id in (select id from descendentes);

    with recursive descendentes as (
      select id from pcm.locais where id = new.id
      union all
      select l.id from pcm.locais l join descendentes d on l.parent_id = d.id
    )
    update pcm.sistemas
      set auvo_localizacao = pcm.fn_montar_localizacao_hierarquica(local_id),
          auvo_descricao = pcm.fn_montar_descricao_auvo(
            cliente_id, area_id, local_id, categoria_id, nome
          )
      where local_id in (select id from descendentes);
  end if;
  return new;
end;
$$;
