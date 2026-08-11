-- 0194_E03-S07_fix_check_valor_mensal.sql — Sinérgica SO
-- Bug real pego no smoke test manual (antes de qualquer código de aplicação usar isto): a CHECK de
-- 0190 (`valor_mensal_centavos > 0`) bloqueava até a CRIAÇÃO do contrato em rascunho quando a
-- proposta de origem tinha `preco_centavos = 0` — mas AC-2 diz "todos editáveis antes de ativar", o
-- que implica que o rascunho pode nascer com valor 0 (ou de uma proposta zerada) pra ser corrigido
-- depois. O "valor zero é recusado" do edge case da spec é uma regra de ATIVAÇÃO, não de criação —
-- e já está em `comercial.fn_ativar_contrato` (migration 0193, guarda explícita). Esta migration só
-- relaxa a CHECK pra permitir o rascunho existir; a guarda de ativação continua intocada.
--
-- Rollback:
--   alter table comercial.contratos drop constraint if exists contratos_valor_mensal_centavos_check;
--   alter table comercial.contratos add constraint contratos_valor_mensal_centavos_check
--     check (valor_mensal_centavos > 0);

-- NOT VALID aqui; VALIDATE CONSTRAINT em transação separada (0195), mesmo padrão de 0091/0092.
alter table comercial.contratos
  drop constraint if exists contratos_valor_mensal_centavos_check;

alter table comercial.contratos
  add constraint contratos_valor_mensal_centavos_check
  check (valor_mensal_centavos is null or valor_mensal_centavos >= 0) not valid;
