-- 0158_E02-S25_trigger_automatico_config.sql — Sinérgica SO
-- Story E02-S25. Config do trigger de resposta automática do Zé — colunas NOVAS, separadas de
-- `janela_dias/janela_inicio/janela_fim` (já existem desde E02-S06 e são usadas por
-- `personaDisponivelAgora` como o horário em que o Zé PODE responder quando mencionado/@zé,
-- E02-S23). A semântica desta story é o OPOSTO: o Zé assume sozinho FORA do horário humano (ou
-- após X min de inatividade humana DENTRO dele) — reaproveitar as mesmas colunas quebraria o gate
-- de acionamento manual já em produção. Ver spec.md/tasks.md pra decisão registrada.
--
-- Reverso:
--   alter table atendimento.personas drop column if exists auto_resposta_ativo;
--   alter table atendimento.personas drop column if exists auto_dias;
--   alter table atendimento.personas drop column if exists auto_janela_inicio;
--   alter table atendimento.personas drop column if exists auto_janela_fim;
--   alter table atendimento.personas drop column if exists auto_min_sem_resposta;

alter table atendimento.personas add column if not exists auto_resposta_ativo boolean not null default false;
alter table atendimento.personas add column if not exists auto_dias integer[] not null default '{}';
alter table atendimento.personas add column if not exists auto_janela_inicio time;
alter table atendimento.personas add column if not exists auto_janela_fim time;
alter table atendimento.personas add column if not exists auto_min_sem_resposta integer not null default 30;

comment on column atendimento.personas.auto_resposta_ativo is 'E02-S25: liga/desliga o trigger de resposta automática (regra global — mesmo valor pra todos os clientes/instâncias).';
comment on column atendimento.personas.auto_dias is 'E02-S25: dias da semana (0=dom..6=sáb) em que HUMANOS respondem — fora desses dias, Zé assume o dia inteiro.';
comment on column atendimento.personas.auto_janela_inicio is 'E02-S25: início do horário humano no dia. Fora dessa janela, Zé responde automático.';
comment on column atendimento.personas.auto_janela_fim is 'E02-S25: fim do horário humano no dia.';
comment on column atendimento.personas.auto_min_sem_resposta is 'E02-S25: minutos sem resposta humana DENTRO do horário até o Zé assumir.';
