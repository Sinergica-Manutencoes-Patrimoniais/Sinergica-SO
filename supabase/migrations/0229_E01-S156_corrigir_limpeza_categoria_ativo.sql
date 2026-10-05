-- 0229_E01-S156_corrigir_limpeza_categoria_ativo.sql
-- Corrige a precedência do trigger da S156: ao desvincular categoria_id sem
-- alterar o texto espelho, o texto também precisa ser limpo (AC-4 passo 2).
-- Reverso: reaplicar a definição de pcm.fn_categoria_ativo_sync de 0219.

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
  elsif new.categoria_id is null and new.categoria is not distinct from old.categoria then
    new.categoria := null;
  elsif new.categoria_id is null and new.categoria is not null then
    select id, nome into v_categoria
      from pcm.equipamento_categorias
      where lower(nome) = lower(new.categoria) and deleted_at is null
      order by created_at, id limit 1;
    if found then new.categoria_id := v_categoria.id; end if;
  end if;
  return new;
end;
$$;
