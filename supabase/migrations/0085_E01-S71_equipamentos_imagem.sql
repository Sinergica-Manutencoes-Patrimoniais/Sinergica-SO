-- 0085_E01-S71_equipamentos_imagem.sql — Sinérgica SO
-- Captura a imagem/anexos do equipamento vindos do Auvo (GET /equipments -> urlImage/uriAnexos,
-- confirmado contra a API real 2026-07-14) — hoje descartados, nenhuma coluna existia. Achado do
-- Lucas testando em produção: "equipamentos possuem imagens e não estão aparecendo".
--
-- Reverso:
--   alter table pcm.equipamentos drop column if exists url_imagem;
--   alter table pcm.equipamentos drop column if exists uri_anexos;

alter table pcm.equipamentos add column if not exists url_imagem text;
alter table pcm.equipamentos add column if not exists uri_anexos jsonb not null default '[]'::jsonb;

-- RLS/grants já existem na tabela (0032) — colunas aditivas não precisam de policy nova.
