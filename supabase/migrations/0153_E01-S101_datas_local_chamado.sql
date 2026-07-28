-- 0153_E01-S101_datas_local_chamado.sql — Sinérgica SO
-- Story E01-S101. Chamado ganha os campos necessários pra já nascer com tudo que a OS vai
-- precisar: `local` (solicitação + local eram os 2 campos essenciais discutidos na reunião de
-- 2026-07-27), e as 3 datas do fluxo (abertura = `created_at`, já existe; planejada = editável,
-- não conta SLA; execução = real, conta SLA junto com abertura). `replanejamentos` conta quantas
-- vezes `data_planejada` mudou depois de já ter sido definida (métrica, não trava nada).
--
-- Reverso:
--   alter table pcm.chamados drop column if exists local;
--   alter table pcm.chamados drop column if exists data_planejada;
--   alter table pcm.chamados drop column if exists data_execucao;
--   alter table pcm.chamados drop column if exists replanejamentos;

alter table pcm.chamados add column if not exists local text;
alter table pcm.chamados add column if not exists data_planejada timestamptz;
alter table pcm.chamados add column if not exists data_execucao timestamptz;
alter table pcm.chamados add column if not exists replanejamentos integer not null default 0;

comment on column pcm.chamados.local is 'E01-S101: local da solicitação (texto livre) — junto com a descrição, é o essencial pra abrir o chamado (reunião 2026-07-27).';
comment on column pcm.chamados.data_planejada is 'E01-S101: quando pretende-se enviar o técnico. Editável (replanejável), NÃO conta SLA.';
comment on column pcm.chamados.data_execucao is 'E01-S101: quando foi de fato executado. Conta SLA junto com created_at (abertura).';
comment on column pcm.chamados.replanejamentos is 'E01-S101: quantas vezes data_planejada mudou depois de já definida (métrica, não trava).';
