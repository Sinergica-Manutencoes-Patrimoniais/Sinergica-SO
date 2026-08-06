-- 0165_E01-S130_assessment_questionario_provisorio.sql
-- Itens vindos de tarefa Auvo em andamento podem mudar no webhook de conclusão.
alter table pcm.inspecao_itens
  add column if not exists auvo_importacao_provisoria boolean not null default false;

comment on column pcm.inspecao_itens.auvo_importacao_provisoria is
  'True enquanto o checklist Auvo de origem ainda não recebeu versão final.';
