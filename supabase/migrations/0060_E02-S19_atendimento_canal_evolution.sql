-- 0060_E02-S19_atendimento_canal_evolution.sql — Sinérgica SO
-- Aba "Evolution" dedicada (E02-S19). Reusa `atendimento.canais_externos` (0057) em vez de criar
-- tabela nova — é a MESMA forma (label, identificador externo, status de conexão) que Meta
-- WA/Instagram/Messenger, só um `tipo` a mais. O vínculo instância→persona (`instancias_agente`,
-- E02-S06) e `config_ze.group_jid/bot_jid` continuam existindo e funcionando (AC-3, sem
-- regressão) — esta aba só promove a CONEXÃO em si a um lugar dedicado, visível.
--
-- Reverso:
--   alter table atendimento.canais_externos drop constraint canais_externos_tipo_check;
--   alter table atendimento.canais_externos add constraint canais_externos_tipo_check
--     check (tipo in ('meta_wa', 'instagram', 'messenger'));

alter table atendimento.canais_externos drop constraint if exists canais_externos_tipo_check;
alter table atendimento.canais_externos add constraint canais_externos_tipo_check
  check (tipo in ('meta_wa', 'instagram', 'messenger', 'evolution')) not valid;

alter table atendimento.canais_externos
  add column if not exists numero_vinculado text;

-- O nome da instância identifica univocamente o recurso remoto na Evolution. Impedir duas linhas
-- ativas para o mesmo nome evita que "desconectar" uma delas derrube silenciosamente a outra.
create unique index if not exists idx_canais_externos_evolution_instancia_ativa
  on atendimento.canais_externos (identificador_externo)
  where tipo = 'evolution' and ativo;
