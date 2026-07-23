-- 0131_E01-S85_localizacao_auvo_hierarquica.sql — Sinérgica SO
-- Story E01-S85. Localização enviada ao Auvo = concatenação Área+Local+Sublocal (denormalizada em
-- `auvo_localizacao`, recalculada por trigger — nunca por join em tempo de leitura, porque
-- `AuvoEntityDescriptor.toAuvo(row)` é função pura sem I/O, ver design.md). Separador/ordem
-- configuráveis (AC-1). Rename de Área/Local propaga (AC-2) reusando o outbox genérico já anexado
-- a `pcm.equipamentos`/`pcm.sistemas` (E01-S22/E01-S76) — só atualiza a coluna denormalizada, o
-- trigger de enqueue existente (`after insert or update or delete`) já cuida do resto.

-- 1) preferência de separador/ordem (superadmin) — mesmo padrão de config.priorizacao_gutd (E01-S82)
create table config.preferencia_localizacao_auvo (
  id         int         primary key default 1 check (id = 1),
  separador  text        not null default ' · ',
  ordem      text        not null default 'area_primeiro'
                          check (ordem in ('area_primeiro', 'area_por_ultimo')),
  updated_at timestamptz not null default now(),
  updated_by uuid        references auth.users (id)
);

alter table config.preferencia_localizacao_auvo enable row level security;
alter table config.preferencia_localizacao_auvo force row level security;

grant select on config.preferencia_localizacao_auvo to authenticated;
grant insert, update on config.preferencia_localizacao_auvo to authenticated;
grant select, insert, update, delete on config.preferencia_localizacao_auvo to service_role;

create policy "preferencia_localizacao_auvo_select" on config.preferencia_localizacao_auvo
  for select to authenticated
  using (true);
create policy "preferencia_localizacao_auvo_escrita_superadmin" on config.preferencia_localizacao_auvo
  for all to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin')
  with check (auth.jwt() ->> 'user_role' = 'superadmin');

insert into config.preferencia_localizacao_auvo (id, separador, ordem)
values (1, ' · ', 'area_primeiro')
on conflict (id) do nothing;

-- 2) coluna denormalizada — nullable, `toAuvo` cai pro `localizacao` texto livre enquanto for null
--    (equipamento sem local_id, ou item ainda não tocado por esta story — zero regressão)
alter table pcm.equipamentos add column if not exists auvo_localizacao text;
alter table pcm.sistemas add column if not exists auvo_localizacao text;

comment on column pcm.equipamentos.auvo_localizacao is
  'E01-S85: Área+Local+Sublocal concatenados (config.preferencia_localizacao_auvo), recalculado por trigger. NULL = ainda sem local_id ou nunca tocado; toAuvo() cai pra `localizacao` (texto livre).';
comment on column pcm.sistemas.auvo_localizacao is
  'E01-S85: nome da Área (sistema não tem local_id, só area_id opcional), recalculado por trigger.';

-- 3) funções de montagem (stable — sem I/O externo, só leitura de pcm.areas/pcm.locais/config)
create or replace function pcm.fn_montar_localizacao_hierarquica(p_local_id uuid)
returns text
language plpgsql
stable
as $$
declare
  v_separador text;
  v_ordem text;
  v_area_id uuid;
  v_locais_nomes text[];
  v_area_nome text;
  v_partes text[];
begin
  if p_local_id is null then
    return null;
  end if;

  select separador, ordem into v_separador, v_ordem
    from config.preferencia_localizacao_auvo where id = 1;
  if v_separador is null then
    v_separador := ' · ';
    v_ordem := 'area_primeiro';
  end if;

  with recursive cadeia as (
    select id, parent_id, nome, area_id, 0 as profundidade
      from pcm.locais where id = p_local_id
    union all
    select l.id, l.parent_id, l.nome, l.area_id, c.profundidade + 1
      from pcm.locais l
      join cadeia c on l.id = c.parent_id
  )
  select max(area_id), array_agg(nome order by profundidade desc)
    into v_area_id, v_locais_nomes
  from cadeia;

  if v_area_id is null then
    return null;
  end if;

  select nome into v_area_nome from pcm.areas where id = v_area_id;
  if v_area_nome is null then
    return null;
  end if;

  v_partes := case
    when v_ordem = 'area_por_ultimo' then v_locais_nomes || v_area_nome
    else array[v_area_nome] || v_locais_nomes
  end;

  return array_to_string(v_partes, v_separador);
end;
$$;

create or replace function pcm.fn_montar_localizacao_area(p_area_id uuid)
returns text
language sql
stable
as $$
  select nome from pcm.areas where id = p_area_id;
$$;

-- 4) recalcula on-write (AC-1/AC-3: mover ativo já enfileira via trigger existente, ver acima)
create or replace function pcm.fn_equipamentos_recalcular_localizacao()
returns trigger
language plpgsql
as $$
begin
  new.auvo_localizacao := pcm.fn_montar_localizacao_hierarquica(new.local_id);
  return new;
end;
$$;

create trigger trg_equipamentos_recalcular_localizacao
  before insert or update of local_id on pcm.equipamentos
  for each row execute function pcm.fn_equipamentos_recalcular_localizacao();

create or replace function pcm.fn_sistemas_recalcular_localizacao()
returns trigger
language plpgsql
as $$
begin
  new.auvo_localizacao := pcm.fn_montar_localizacao_area(new.area_id);
  return new;
end;
$$;

create trigger trg_sistemas_recalcular_localizacao
  before insert or update of area_id on pcm.sistemas
  for each row execute function pcm.fn_sistemas_recalcular_localizacao();

-- 5) AC-2: rename de Área/Local propaga em lote pros ativos afetados (fan-out atualiza a coluna
--    denormalizada; o trigger de enqueue JÁ ANEXADO em equipamentos/sistemas — `after insert or
--    update or delete`, 0032/0095 — cuida de reenfileirar, sem precisar tocar no outbox aqui).
create or replace function pcm.fn_areas_propagar_localizacao()
returns trigger
language plpgsql
as $$
begin
  if new.nome is distinct from old.nome then
    update pcm.equipamentos
      set auvo_localizacao = pcm.fn_montar_localizacao_hierarquica(local_id)
      where local_id in (select id from pcm.locais where area_id = new.id);

    update pcm.sistemas
      set auvo_localizacao = pcm.fn_montar_localizacao_area(new.id)
      where area_id = new.id;
  end if;
  return new;
end;
$$;

create trigger trg_areas_propagar_localizacao
  after update of nome on pcm.areas
  for each row execute function pcm.fn_areas_propagar_localizacao();

create or replace function pcm.fn_locais_propagar_localizacao()
returns trigger
language plpgsql
as $$
begin
  if new.nome is distinct from old.nome then
    update pcm.equipamentos
      set auvo_localizacao = pcm.fn_montar_localizacao_hierarquica(local_id)
      where local_id in (
        with recursive descendentes as (
          select id from pcm.locais where id = new.id
          union all
          select l.id from pcm.locais l join descendentes d on l.parent_id = d.id
        )
        select id from descendentes
      );
  end if;
  return new;
end;
$$;

create trigger trg_locais_propagar_localizacao
  after update of nome on pcm.locais
  for each row execute function pcm.fn_locais_propagar_localizacao();
