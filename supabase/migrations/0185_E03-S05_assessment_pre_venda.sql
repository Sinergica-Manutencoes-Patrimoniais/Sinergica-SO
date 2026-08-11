-- 0185_E03-S05_assessment_pre_venda.sql — Sinérgica SO
-- Story E03-S05. O levantamento comercial é um Assessment do PCM (E01-S90) com finalidade de
-- pré-venda — não uma entidade nova (decisão 6 do PO). Duas peças:
--
-- 1) `motivo_assessment` ganha o valor 'pre_venda' — o check hoje só permite
--    'inicio'|'alteracao_contrato'|'anual' (E01-S90), nenhum cobre "levantamento antes de
--    virar cliente".
-- 2) `pcm.fn_criar_assessment_pre_venda` — a interface publicada que o Comercial chama (ADR-0019
--    R1/R2: pcm.inspecoes é do PCM, o Comercial nunca faz insert/select direto nela).
--
-- Reverso:
--   drop function if exists pcm.fn_criar_assessment_pre_venda(uuid, text);
--   alter table pcm.inspecoes drop constraint if exists inspecoes_motivo_assessment_check;
--   alter table pcm.inspecoes add constraint inspecoes_motivo_assessment_check
--     check (motivo_assessment = any (array['inicio','alteracao_contrato','anual']));

-- NOT VALID aqui; VALIDATE CONSTRAINT em transação separada (0186), mesmo padrão de 0091/0092.
alter table pcm.inspecoes drop constraint if exists inspecoes_motivo_assessment_check;
alter table pcm.inspecoes add constraint inspecoes_motivo_assessment_check
  check (motivo_assessment = any (array['inicio', 'alteracao_contrato', 'anual', 'pre_venda'])) not valid;

create or replace function pcm.fn_criar_assessment_pre_venda(p_cliente_id uuid, p_titulo text default null)
returns pcm.inspecoes
language plpgsql
security definer
set search_path = pcm, pg_temp
as $$
declare
  v_inspecao pcm.inspecoes%rowtype;
begin
  -- `security definer`, não invoker: a policy de INSERT de pcm.inspecoes exige pcm:escrita, e um
  -- usuário só-Comercial (comercial:escrita, sem pcm) passaria na guarda abaixo mas seria negado
  -- pela RLS na hora do insert se a função rodasse como invoker. A guarda AQUI é a autoridade real.
  if coalesce(
    (auth.jwt() ->> 'user_role') = 'superadmin'
    or (auth.jwt() -> 'user_modulos' ->> 'comercial') = 'escrita'
    or (auth.jwt() -> 'user_modulos' ->> 'pcm') = 'escrita',
    false
  ) is not true then
    raise exception 'permission denied for function fn_criar_assessment_pre_venda' using errcode = '42501';
  end if;

  insert into pcm.inspecoes (client_id, titulo, data_inspecao, e_assessment, motivo_assessment, created_by)
  values (
    p_cliente_id,
    coalesce(p_titulo, 'Levantamento de pré-venda'),
    current_date,
    true,
    'pre_venda',
    auth.uid()
  )
  returning * into v_inspecao;

  return v_inspecao;
end;
$$;

revoke all on function pcm.fn_criar_assessment_pre_venda(uuid, text) from public;
grant execute on function pcm.fn_criar_assessment_pre_venda(uuid, text) to authenticated;

-- ─────────────────────────── leitura para o Comercial ───────────────────────
-- AC-2/AC-4/AC-7: o Comercial precisa listar assessments de uma Conta (vincular à proposta,
-- mostrar na Visão 360) mesmo quando o usuário só tem `comercial`, sem `pcm`. Por isso é RPC
-- `security definer` com guarda PRÓPRIA — não uma view `security_invoker`: a RLS de
-- `pcm.inspecoes` (`inspecoes_select`) só libera quem tem módulo `pcm`, e herdar isso quebraria
-- o AC-7 pra um comercial puro. A função decide sozinha quem pode ler, e só devolve os campos
-- que o Comercial precisa — nada de dado técnico/clínico detalhado.

create or replace function pcm.fn_listar_assessments_conta(p_cliente_id uuid)
returns table(
  id uuid,
  titulo text,
  data_inspecao date,
  status text,
  motivo_assessment text,
  total_itens int,
  itens_conformes int,
  itens_nao_conformes int,
  itens_atencao int,
  created_at timestamptz
)
language plpgsql
security definer
stable
set search_path = pcm, pg_temp
as $$
begin
  if coalesce(
    (auth.jwt() ->> 'user_role') = 'superadmin'
    or (auth.jwt() -> 'user_modulos' ->> 'comercial') in ('leitura', 'escrita')
    or (auth.jwt() -> 'user_modulos' ->> 'pcm') in ('leitura', 'escrita'),
    false
  ) is not true then
    raise exception 'permission denied for function fn_listar_assessments_conta' using errcode = '42501';
  end if;

  return query
  select i.id, i.titulo, i.data_inspecao, i.status, i.motivo_assessment,
         i.total_itens, i.itens_conformes, i.itens_nao_conformes, i.itens_atencao, i.created_at
    from pcm.inspecoes i
   where i.client_id = p_cliente_id
     and i.e_assessment = true
   order by i.created_at desc;
end;
$$;

revoke all on function pcm.fn_listar_assessments_conta(uuid) from public;
grant execute on function pcm.fn_listar_assessments_conta(uuid) to authenticated;

comment on function pcm.fn_listar_assessments_conta(uuid) is
  'E03-S05: interface de leitura publicada pelo PCM para o Comercial (ADR-0019 R2). Guarda '
  'própria (comercial OU pcm) — não herda a RLS de pcm.inspecoes, que exigiria módulo pcm.';
