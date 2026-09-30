-- 0219_E01-S156_categoria_ativo_catalogo.sql
-- Categoria de Componente/Sistema aponta para o catálogo Auvo. Backfill de equipamentos usa
-- app.auvo_sync_write: jamais dispara PATCH em massa para o Auvo.

alter table pcm.equipamento_categorias add column if not exists sigla text;
alter table pcm.equipamento_categorias
  add constraint ck_equipamento_categorias_sigla
  check (sigla is null or sigla ~ '^[A-Z0-9]{3}$') not valid;
create unique index uq_equipamento_categorias_sigla
  on pcm.equipamento_categorias (sigla)
  where deleted_at is null and sigla is not null;

alter table pcm.equipamentos add column if not exists categoria_id uuid;
alter table pcm.equipamentos
  add constraint fk_equipamentos_categoria foreign key (categoria_id)
  references pcm.equipamento_categorias (id) not valid;
create index idx_equipamentos_categoria
  on pcm.equipamentos (categoria_id) where deleted_at is null;

alter table pcm.sistemas add column if not exists categoria_id uuid;
alter table pcm.sistemas add column if not exists categoria text;
alter table pcm.sistemas
  add constraint fk_sistemas_categoria foreign key (categoria_id)
  references pcm.equipamento_categorias (id) not valid;
create index idx_sistemas_categoria
  on pcm.sistemas (categoria_id) where deleted_at is null;

-- Nome deliberado: roda antes de normalizar_posicao e recalcular_localizacao nos BEFORE.
create or replace function pcm.fn_categoria_ativo_sync()
returns trigger
language plpgsql
as $$
declare
  v_categoria record;
begin
  if new.categoria_id is not null and new.categoria_id is distinct from old.categoria_id then
    select id, nome into v_categoria
      from pcm.equipamento_categorias where id = new.categoria_id and deleted_at is null;
    if found then new.categoria := v_categoria.nome; end if;
  elsif new.categoria_id is null and new.categoria is not null then
    select id, nome into v_categoria
      from pcm.equipamento_categorias
      where lower(nome) = lower(new.categoria) and deleted_at is null
      order by created_at, id limit 1;
    if found then new.categoria_id := v_categoria.id; end if;
  elsif new.categoria_id is null and new.categoria is not distinct from old.categoria then
    new.categoria := null;
  end if;
  return new;
end;
$$;

create trigger trg_equipamentos_categoria_sync
  before insert or update of categoria_id, categoria on pcm.equipamentos
  for each row execute function pcm.fn_categoria_ativo_sync();
create trigger trg_sistemas_categoria_sync
  before insert or update of categoria_id, categoria on pcm.sistemas
  for each row execute function pcm.fn_categoria_ativo_sync();

-- Seeds enfileiram create no Auvo. Atualiza no máximo seis linhas de catálogo, nunca ativos.
insert into pcm.equipamento_categorias (nome, sigla)
select v.nome, v.sigla
from (values
  ('Elétrica', 'ELE'), ('Hidráulica', 'HID'), ('Transporte Vertical', 'TRV'),
  ('Climatização', 'CLI'), ('Segurança', 'SEG'), ('PCI (Prevenção e Combate a Incêndio)', 'PCI')
) as v(nome, sigla)
where not exists (
  select 1 from pcm.equipamento_categorias c
  where lower(c.nome) = lower(v.nome) and c.deleted_at is null
);

update pcm.equipamento_categorias c
set sigla = v.sigla
from (values
  ('Elétrica', 'ELE'), ('Hidráulica', 'HID'), ('Transporte Vertical', 'TRV'),
  ('Climatização', 'CLI'), ('Segurança', 'SEG'), ('PCI (Prevenção e Combate a Incêndio)', 'PCI')
) as v(nome, sigla)
where lower(c.nome) = lower(v.nome) and c.deleted_at is null and c.sigla is null;

-- Único backfill massivo da iniciativa; flag faz fn_auvo_enqueue retornar sem PATCH.
set local app.auvo_sync_write = 'true';
update pcm.equipamentos e
set categoria_id = c.id
from pcm.equipamento_categorias c
where e.categoria_id is null and e.categoria is not null
  and lower(c.nome) = lower(e.categoria) and c.deleted_at is null;
