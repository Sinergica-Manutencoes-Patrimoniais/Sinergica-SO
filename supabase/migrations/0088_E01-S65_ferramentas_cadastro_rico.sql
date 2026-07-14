-- 0088_E01-S65_ferramentas_cadastro_rico.sql — Sinérgica SO
-- Feedback Fabrício (2026-07-13): cadastro de ferramenta precisa ser mais fácil, com mais campos,
-- imagem quando o Auvo tiver. GET /products confirmado com `imageUrl`/`uriAttachments`/`code`
-- (2026-07-13) — escrita de imagem NÃO confirmada contra a API real ainda (precisa credencial/
-- decisão do PO antes de ligar `toAuvo`/`toAuvoUpdate`); por isso estas colunas são só LEITURA
-- por enquanto (populadas pelo pull do Auvo, nunca editadas pelo PCM).
--
-- Reverso:
--   alter table pcm.ferramentas drop column if exists imagem_url;
--   alter table pcm.ferramentas drop column if exists uri_anexos;
--   alter table pcm.ferramentas drop column if exists codigo_auvo;

alter table pcm.ferramentas add column if not exists imagem_url text;
alter table pcm.ferramentas add column if not exists uri_anexos jsonb not null default '[]'::jsonb;
alter table pcm.ferramentas add column if not exists codigo_auvo text;

-- RLS/grants já existem na tabela (0033) — colunas aditivas não precisam de policy nova.
