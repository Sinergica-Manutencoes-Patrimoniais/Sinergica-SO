-- 0089_E01-S66_kits_ferramentas.sql — Sinérgica SO
-- Feedback Fabrício (2026-07-13): "criação de Kits de ferramentas contendo as ferramentas". Kit é
-- conceito só do PCM (Auvo não tem endpoint de agrupamento) — agrupa unidades existentes
-- (`pcm.ferramenta_unidades`, E01-S63) pra atribuir/devolver várias de uma vez, tudo-ou-nada.
--
-- Reverso:
--   drop function if exists pcm.fn_devolver_kit(uuid, text, uuid);
--   drop function if exists pcm.fn_atribuir_kit(uuid, uuid, uuid);
--   alter table pcm.ferramenta_movimentacoes drop column if exists kit_atribuicao_id;
--   drop table if exists pcm.kit_itens;
--   drop table if exists pcm.kits;

create table if not exists pcm.kits (
  id          uuid        primary key default gen_random_uuid(),
  nome        text        not null,
  descricao   text,
  ativo       boolean     not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid        references auth.users,
  updated_at  timestamptz not null default now(),
  updated_by  uuid        references auth.users,
  deleted_at  timestamptz
);

create table if not exists pcm.kit_itens (
  id            uuid        primary key default gen_random_uuid(),
  kit_id        uuid        not null references pcm.kits on delete cascade,
  ferramenta_id uuid        not null references pcm.ferramentas on delete cascade,
  quantidade    int         not null check (quantidade > 0),
  created_at    timestamptz not null default now(),
  created_by    uuid        references auth.users,
  unique (kit_id, ferramenta_id)
);

-- Correlaciona as movimentações que uma mesma atribuição/devolução de KIT gerou (várias unidades,
-- 1 evento). Sem FK pra `pcm.kits` de propósito: é um id de correlação do EVENTO, não do kit —
-- continua íntegro mesmo se o kit for editado/desativado depois (AC-5, não retroage).
alter table pcm.ferramenta_movimentacoes add column if not exists kit_atribuicao_id uuid;
create index if not exists idx_ferramenta_movimentacoes_kit_atribuicao
  on pcm.ferramenta_movimentacoes (kit_atribuicao_id)
  where kit_atribuicao_id is not null;

create index if not exists idx_kit_itens_kit on pcm.kit_itens (kit_id);
create index if not exists idx_kits_deleted_nome on pcm.kits (deleted_at, nome);

alter table pcm.kits enable row level security;
alter table pcm.kits force row level security;
alter table pcm.kit_itens enable row level security;
alter table pcm.kit_itens force row level security;

grant select, insert, update on pcm.kits to authenticated;
grant select, insert, update, delete on pcm.kits to service_role;
grant select, insert, update, delete on pcm.kit_itens to authenticated;
grant select, insert, update, delete on pcm.kit_itens to service_role;

create policy "kits_select" on pcm.kits
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "kits_insert" on pcm.kits
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "kits_update" on pcm.kits
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

-- kit_itens NÃO é append-only (AC-5: composição pode ser editada — adicionar/remover item) —
-- diferente de ferramenta_movimentacoes.
create policy "kit_itens_select" on pcm.kit_itens
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

create policy "kit_itens_insert" on pcm.kit_itens
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

create policy "kit_itens_delete" on pcm.kit_itens
  for delete to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

-- AC-2: atribuição tudo-ou-nada. SECURITY INVOKER (padrão, sem `security definer`) de propósito —
-- roda com o papel de quem chama, então os INSERTs em `ferramenta_movimentacoes` e os SELECTs em
-- `kit_itens`/`ferramenta_unidades` continuam sob as MESMAS policies de RLS já existentes (pcm
-- leitura/escrita), sem precisar reimplementar a checagem de permissão aqui dentro. Se faltar
-- unidade de qualquer item do kit, o RAISE EXCEPTION desfaz TUDO que essa chamada já tinha
-- inserido (é uma função só, dentro de uma transação implícita) — nunca atribui pela metade.
create or replace function pcm.fn_atribuir_kit(
  p_kit_id uuid,
  p_funcionario_id uuid,
  p_user_id uuid
) returns uuid
language plpgsql
set search_path = pcm, public
as $$
declare
  v_kit_atribuicao_id uuid := gen_random_uuid();
  v_item record;
  v_unidade record;
  v_faltando int;
begin
  for v_item in
    select ki.ferramenta_id, ki.quantidade, f.nome as ferramenta_nome
    from pcm.kit_itens ki
    join pcm.ferramentas f on f.id = ki.ferramenta_id
    where ki.kit_id = p_kit_id
  loop
    v_faltando := v_item.quantidade;
    for v_unidade in
      select id
      from pcm.ferramenta_unidades
      where ferramenta_id = v_item.ferramenta_id and status = 'disponivel'
      order by codigo
      limit v_item.quantidade
      for update skip locked
    loop
      insert into pcm.ferramenta_movimentacoes (unidade_id, tipo, funcionario_id, kit_atribuicao_id, created_by)
      values (v_unidade.id, 'atribuicao', p_funcionario_id, v_kit_atribuicao_id, p_user_id);
      v_faltando := v_faltando - 1;
    end loop;
    if v_faltando > 0 then
      raise exception 'Kit incompleto: falta % unidade(s) de % pra atribuir', v_faltando, v_item.ferramenta_nome;
    end if;
  end loop;

  return v_kit_atribuicao_id;
end;
$$;

grant execute on function pcm.fn_atribuir_kit(uuid, uuid, uuid) to authenticated;

-- AC-3: devolve de uma vez toda unidade ainda `atribuida` que veio da mesma atribuição de kit.
-- Reaproveita o trigger de E01-S63 (`fn_aplicar_movimentacao_ferramenta`) pra aplicar a devolução
-- em cada unidade — não duplica a lógica de transição de estado aqui.
create or replace function pcm.fn_devolver_kit(
  p_kit_atribuicao_id uuid,
  p_condicao text,
  p_user_id uuid
) returns int
language plpgsql
set search_path = pcm, public
as $$
declare
  v_unidade record;
  v_count int := 0;
begin
  for v_unidade in
    select distinct u.id
    from pcm.ferramenta_unidades u
    join pcm.ferramenta_movimentacoes m on m.unidade_id = u.id
    where m.kit_atribuicao_id = p_kit_atribuicao_id
      and m.tipo = 'atribuicao'
      and u.status = 'atribuida'
  loop
    insert into pcm.ferramenta_movimentacoes (unidade_id, tipo, condicao, kit_atribuicao_id, created_by)
    values (v_unidade.id, 'devolucao', p_condicao, p_kit_atribuicao_id, p_user_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function pcm.fn_devolver_kit(uuid, text, uuid) to authenticated;
