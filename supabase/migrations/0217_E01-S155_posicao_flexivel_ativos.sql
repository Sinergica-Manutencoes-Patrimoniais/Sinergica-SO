-- 0217_E01-S155_posicao_flexivel_ativos.sql
-- Componente (pcm.equipamentos) e Sistema (pcm.sistemas) passam a poder ser posicionados em
-- Cliente, Área ou Local — cliente obrigatório na borda do SO (não no banco, pelo inbound do
-- Auvo), Área sempre derivada do Local quando há Local. Ver design.md (D3) da iniciativa
-- "Cadastro de ativos v2".
--
-- Reverso:
--   drop trigger if exists trg_locais_propagar_localizacao on pcm.locais;
--   drop trigger if exists trg_areas_propagar_localizacao on pcm.areas;
--   drop trigger if exists trg_sistemas_recalcular_localizacao on pcm.sistemas;
--   drop trigger if exists trg_equipamentos_recalcular_localizacao on pcm.equipamentos;
--   drop trigger if exists trg_sistemas_normalizar_posicao on pcm.sistemas;
--   drop trigger if exists trg_equipamentos_normalizar_posicao on pcm.equipamentos;
--   drop function if exists pcm.fn_sistemas_normalizar_posicao();
--   drop function if exists pcm.fn_equipamentos_normalizar_posicao();
--   alter table pcm.sistemas drop constraint if exists fk_sistemas_local, drop column if exists local_id;
--   alter table pcm.equipamentos drop constraint if exists fk_equipamentos_area, drop column if exists area_id;

alter table pcm.equipamentos add column if not exists area_id uuid;
alter table pcm.equipamentos
  add constraint fk_equipamentos_area foreign key (area_id) references pcm.areas (id) not valid;
create index if not exists idx_equipamentos_area
  on pcm.equipamentos (area_id) where deleted_at is null;

alter table pcm.sistemas add column if not exists local_id uuid;
alter table pcm.sistemas
  add constraint fk_sistemas_local foreign key (local_id) references pcm.locais (id) not valid;
create index if not exists idx_sistemas_local
  on pcm.sistemas (local_id) where deleted_at is null;

-- ── Normaliza posição: Local define a Área; Área define o cliente quando ausente; cliente
-- divergente da Área/Local é rejeitado. Nome do trigger começa com "normalizar_posicao" de
-- propósito — roda antes de "recalcular_localizacao" (ordem alfabética de trigger BEFORE no
-- Postgres), que depende de area_id/local_id já corrigidos. ──────────────────────────────────
create or replace function pcm.fn_equipamentos_normalizar_posicao()
returns trigger
language plpgsql
as $$
declare
  v_area_do_local uuid;
  v_cliente_area uuid;
begin
  if new.local_id is not null then
    select area_id into v_area_do_local from pcm.locais where id = new.local_id;
    new.area_id := v_area_do_local;
  end if;

  if new.area_id is not null then
    select cliente_id into v_cliente_area from pcm.areas where id = new.area_id;
    if new.client_id is null then
      new.client_id := v_cliente_area;
    elsif new.client_id is distinct from v_cliente_area then
      raise exception using errcode = '23514', message = 'posicao_cliente_divergente';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_equipamentos_normalizar_posicao
  before insert or update of local_id, area_id, client_id on pcm.equipamentos
  for each row execute function pcm.fn_equipamentos_normalizar_posicao();

create or replace function pcm.fn_sistemas_normalizar_posicao()
returns trigger
language plpgsql
as $$
declare
  v_area_do_local uuid;
  v_cliente_area uuid;
begin
  if new.local_id is not null then
    select area_id into v_area_do_local from pcm.locais where id = new.local_id;
    new.area_id := v_area_do_local;
  end if;

  if new.area_id is not null then
    select cliente_id into v_cliente_area from pcm.areas where id = new.area_id;
    if new.cliente_id is null then
      new.cliente_id := v_cliente_area;
    elsif new.cliente_id is distinct from v_cliente_area then
      raise exception using errcode = '23514', message = 'posicao_cliente_divergente';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_sistemas_normalizar_posicao
  before insert or update of local_id, area_id, cliente_id on pcm.sistemas
  for each row execute function pcm.fn_sistemas_normalizar_posicao();

-- ── Recalcula auvo_localizacao: prioridade pro Local (caminho hierárquico completo); sem Local,
-- cai pro nome da Área; sem os dois, null. Recriado pra disparar também em `area_id` (antes só
-- `local_id`/`area_id` separados por tabela — E01-S85). ────────────────────────────────────────
create or replace function pcm.fn_equipamentos_recalcular_localizacao()
returns trigger
language plpgsql
as $$
begin
  new.auvo_localizacao := coalesce(
    pcm.fn_montar_localizacao_hierarquica(new.local_id),
    pcm.fn_montar_localizacao_area(new.area_id)
  );
  return new;
end;
$$;

drop trigger if exists trg_equipamentos_recalcular_localizacao on pcm.equipamentos;
create trigger trg_equipamentos_recalcular_localizacao
  before insert or update of local_id, area_id on pcm.equipamentos
  for each row execute function pcm.fn_equipamentos_recalcular_localizacao();

create or replace function pcm.fn_sistemas_recalcular_localizacao()
returns trigger
language plpgsql
as $$
begin
  new.auvo_localizacao := coalesce(
    pcm.fn_montar_localizacao_hierarquica(new.local_id),
    pcm.fn_montar_localizacao_area(new.area_id)
  );
  return new;
end;
$$;

drop trigger if exists trg_sistemas_recalcular_localizacao on pcm.sistemas;
create trigger trg_sistemas_recalcular_localizacao
  before insert or update of local_id, area_id on pcm.sistemas
  for each row execute function pcm.fn_sistemas_recalcular_localizacao();

-- ── Propagação de rename: Componente/Sistema só com Área (sem Local) agora também precisa
-- recalcular quando a Área é renomeada; Sistema com Local agora também precisa recalcular quando
-- o Local (ou um ancestral) é renomeado. ────────────────────────────────────────────────────────
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
      )
      where area_id = new.id
         or local_id in (select id from pcm.locais where area_id = new.id);

    update pcm.sistemas
      set auvo_localizacao = coalesce(
        pcm.fn_montar_localizacao_hierarquica(local_id),
        pcm.fn_montar_localizacao_area(area_id)
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
      set auvo_localizacao = pcm.fn_montar_localizacao_hierarquica(local_id)
      where local_id in (select id from descendentes);

    with recursive descendentes as (
      select id from pcm.locais where id = new.id
      union all
      select l.id from pcm.locais l join descendentes d on l.parent_id = d.id
    )
    update pcm.sistemas
      set auvo_localizacao = pcm.fn_montar_localizacao_hierarquica(local_id)
      where local_id in (select id from descendentes);
  end if;
  return new;
end;
$$;
