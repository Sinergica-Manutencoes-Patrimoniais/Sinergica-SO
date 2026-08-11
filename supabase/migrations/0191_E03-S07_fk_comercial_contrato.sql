-- 0191_E03-S07_fk_comercial_contrato.sql — Sinérgica SO
-- Story E03-S07, AC-6. `financeiro.contratos.comercial_contrato_id` — opcional (nullable): contrato
-- legado (cadastrado direto no Financeiro antes do E03) fica nulo pra sempre, continua gerando
-- recebível normalmente. Confirmado em produção (2026-08-11): `financeiro.contratos` está com ZERO
-- linhas hoje — não há dado legado real pra migrar, mas a coluna nasce nullable de qualquer forma,
-- porque nada impede alguém de cadastrar direto no Financeiro no futuro (fora do fluxo comercial).
--
-- `fn_gerar_recorrencias` (0113) não seleciona esta coluna — adicioná-la não muda o cron em nada
-- (task 1/AC-4 confirmado por leitura da função antes de escrever esta migration).
--
-- NOT VALID + VALIDATE em transação separada (0192_..., padrão 0091/0092) — mesmo com zero linhas
-- hoje, é o padrão do repositório pra ALTER TABLE ADD CONSTRAINT em tabela que pode crescer entre o
-- lint e o push.
--
-- Rollback:
--   alter table financeiro.contratos drop constraint if exists contratos_comercial_contrato_id_fkey;
--   alter table financeiro.contratos drop column if exists comercial_contrato_id;

alter table financeiro.contratos
  add column comercial_contrato_id uuid;

alter table financeiro.contratos
  add constraint contratos_comercial_contrato_id_fkey
  foreign key (comercial_contrato_id) references comercial.contratos (id) not valid;

comment on column financeiro.contratos.comercial_contrato_id is
  'E03-S07: origem comercial do plano de faturamento, quando existir. NULL = contrato legado, '
  'cadastrado direto no Financeiro antes do E03 (AC-6) — continua gerando recebível normalmente.';
