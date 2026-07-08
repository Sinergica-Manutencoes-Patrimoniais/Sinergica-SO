-- 0053_E02-S13_atendimento_config_ia.sql — Sinérgica SO
-- Aba de config "IA" (E02-S13, paridade heziomos `AISettingsTab`, escopo reduzido ao AC da
-- story): identidade + modelo LLM + janela de atendimento por persona. Reusa `atendimento.personas`
-- (já é "a identidade do agente") em vez de criar tabela nova redundante — número/instância já é
-- coberto por `atendimento.instancias_agente` (E02-S06), não duplicado aqui.
--
-- Reverso:
--   alter table atendimento.personas drop column if exists modelo_llm;
--   alter table atendimento.personas drop column if exists janela_inicio;
--   alter table atendimento.personas drop column if exists janela_fim;
--   alter table atendimento.personas drop column if exists janela_dias;

alter table atendimento.personas
  add column if not exists modelo_llm text not null default 'openrouter/auto',
  add column if not exists janela_inicio time,
  add column if not exists janela_fim time,
  add column if not exists janela_dias int[] not null default '{0,1,2,3,4,5,6}';

comment on column atendimento.personas.modelo_llm is
  'Identificador do modelo LLM (formato OpenRouter, ex. openai/gpt-4o-mini) usado por esta persona.';
comment on column atendimento.personas.janela_inicio is
  'Início da janela de atendimento (hora local); null = sem restrição de horário.';
comment on column atendimento.personas.janela_fim is
  'Fim da janela de atendimento (hora local); null = sem restrição de horário.';
comment on column atendimento.personas.janela_dias is
  'Dias da semana em que a janela vale (0=domingo..6=sábado); default todos os dias.';
