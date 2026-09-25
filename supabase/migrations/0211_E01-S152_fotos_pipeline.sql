-- E01-S152: fotos de item de inspeção seguem a cadeia Inspeção → Backlog → Chamado → OS.
-- `pcm.inspecao_itens.foto_urls` (migration 0150) já existe; `ordens_servico`/`chamados` nunca
-- ganharam coluna de foto — sem elas, toda derivação (backlog/chamado/OS) perdia as imagens.
--
-- Reverso:
--   alter table pcm.ordens_servico drop column if exists foto_urls;
--   alter table pcm.chamados drop column if exists foto_urls;

alter table pcm.ordens_servico add column if not exists foto_urls jsonb not null default '[]'::jsonb;
alter table pcm.chamados add column if not exists foto_urls jsonb not null default '[]'::jsonb;
