-- 0179_E01-S143_inspecao_itens_dor_cliente.sql — Sinérgica SO
-- Correção da E01-S143 (achado do PO em 2026-08-10, validando em localhost).
--
-- O modal "Revisar antes de gerar backlog" pedia só Gravidade/Urgência/Tendência e mostrava
-- `Score PCM (GUT): 27` (3×3×3) — o GUT clássico. Mas o critério de priorização do projeto é
-- **GUTd** desde a E01-S82: quatro fatores (G, U, T e **dor do cliente**), média ponderada com
-- pesos configuráveis em `config.priorizacao_gutd` (hoje 25% cada), na escala 1..5 — não o
-- produto 1..125.
--
-- `pcm.ordens_servico` já tem `dor_cliente` (E01-S82); `pcm.inspecao_itens` ficou sem, então o
-- item de inspeção não tinha onde guardar o quarto fator antes de virar OS de backlog.
--
-- Rollback:
--   alter table pcm.inspecao_itens drop column if exists dor_cliente;

-- squawk-ignore prefer-bigint-over-smallint
alter table pcm.inspecao_itens add column if not exists dor_cliente smallint
  check (dor_cliente between 1 and 5);

comment on column pcm.inspecao_itens.dor_cliente is
  'E01-S143 (corrigido): quarto fator do GUTd (E01-S82) — o quanto o problema dói para o cliente, '
  '1..5. Nulo é permitido e NÃO penaliza: calcularScoreGutd redistribui o peso de D entre G/U/T.';
