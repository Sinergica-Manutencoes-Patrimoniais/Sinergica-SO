-- 0132_E01-S85_fix_max_uuid.sql — Sinérgica SO
-- Corrige `pcm.fn_montar_localizacao_hierarquica` (0131): `max(uuid)` não existe no Postgres —
-- achado pela verificação read-only contra dados reais antes de considerar a função pronta (AC-5,
-- "nunca gravar dado malformado sem verificação"). Troca por `array_agg(...)[1]` — todo local na
-- cadeia tem o mesmo `area_id` (invariante já garantida por `fn_locais_valida_hierarquia`).

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
  select (array_agg(area_id))[1], array_agg(nome order by profundidade desc)
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
