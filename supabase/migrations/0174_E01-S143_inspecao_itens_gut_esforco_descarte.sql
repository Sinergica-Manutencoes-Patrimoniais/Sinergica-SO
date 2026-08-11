-- 0174_E01-S143_inspecao_itens_gut_esforco_descarte.sql — Sinérgica SO
-- Fabrício revisa os itens de uma inspeção e decide, por item: manda pra backlog (a IA calcula
-- GUT + esforço estimado + embasamento normativo, mesmo motor da E01-S105/`importar-relatorio-pdf`,
-- reusado sem prompt novo) ou descarta. Hoje `pcm.inspecao_itens` não tem onde guardar esse
-- resultado — mesmo no import (E01-S105) esses valores são só transitórios (viram texto de
-- `recomendacao` e depois se perdem). Colunas aditivas, mesmo padrão de 0091/0137/0150.
--
-- Reverso:
--   alter table pcm.inspecao_itens drop constraint if exists inspecao_itens_destino_check;
--   alter table pcm.inspecao_itens add constraint inspecao_itens_destino_check
--     check (destino in ('chamado', 'backlog', 'os'));
--   alter table pcm.inspecao_itens drop column if exists gravidade, drop column if exists urgencia,
--     drop column if exists tendencia, drop column if exists esforco_horas,
--     drop column if exists justificativa_esforco, drop column if exists citacao_normativa;

-- Intencional: GUT é 1..5, travado por check. A regra do Squawk existe para id/contador, que
-- estoura o limite de 16 bits; aqui o domínio garante que nunca passa de 5.
-- squawk-ignore prefer-bigint-over-smallint
alter table pcm.inspecao_itens add column if not exists gravidade smallint
  check (gravidade between 1 and 5);
-- squawk-ignore prefer-bigint-over-smallint
alter table pcm.inspecao_itens add column if not exists urgencia smallint
  check (urgencia between 1 and 5);
-- squawk-ignore prefer-bigint-over-smallint
alter table pcm.inspecao_itens add column if not exists tendencia smallint
  check (tendencia between 1 and 5);
alter table pcm.inspecao_itens add column if not exists esforco_horas numeric(6, 2);
alter table pcm.inspecao_itens add column if not exists justificativa_esforco text;
alter table pcm.inspecao_itens add column if not exists citacao_normativa text;

-- `destino` ganha 'descarte' — item revisado e descartado, sem entidade derivada (D3 da E01-S90:
-- vínculo item→entidade fica na entidade derivada; descarte não cria entidade, só marca o item).
alter table pcm.inspecao_itens drop constraint if exists inspecao_itens_destino_check;
-- Intencional: o check está sendo AMPLIADO (ganha 'descarte'), então nenhuma linha existente pode
-- ser invalidada por ele — o scan de validação é rápido e não há risco de a migration falhar no
-- meio por dado antigo. `NOT VALID` + `VALIDATE` em duas migrations seria cerimônia sem ganho aqui.
-- squawk-ignore constraint-missing-not-valid
alter table pcm.inspecao_itens add constraint inspecao_itens_destino_check
  check (destino in ('chamado', 'backlog', 'os', 'descarte'));

comment on column pcm.inspecao_itens.gravidade is 'E01-S143: GUT calculado pela IA (importar-relatorio-pdf) ao enviar o item pra backlog — 1..5, editável na revisão antes de confirmar.';
comment on column pcm.inspecao_itens.esforco_horas is 'E01-S143: estimativa de horas calculada pela IA junto com o GUT — editável na revisão.';
comment on column pcm.inspecao_itens.citacao_normativa is 'E01-S143: embasamento normativo (NBR/norma) que justifica o item como ponto a corrigir — calculado pela IA, editável.';
