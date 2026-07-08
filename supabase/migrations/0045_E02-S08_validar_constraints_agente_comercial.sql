-- 0045_E02-S08_validar_constraints_agente_comercial.sql — Sinérgica SO
-- Validação separada das constraints adicionadas como NOT VALID em `0043`, seguindo o padrão
-- anti-lock de `0004`/`0005`.
--
-- Reverso:
--   -- sem reverso destrutivo; a constraint já existia em 0043.

alter table atendimento.mensagens validate constraint mensagens_remetente_tipo_check;
alter table comercial.leads validate constraint leads_conversa_id_fkey;
