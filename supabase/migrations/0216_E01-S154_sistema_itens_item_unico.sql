-- 0216_E01-S154_sistema_itens_item_unico.sql
-- Componente pertence a no máximo 1 Sistema (E01-S154, AC-3). Pré-checagem de duplicatas em
-- produção (2026-09-30, read-only) confirmou 0 linhas com o mesmo item_id em >1 sistema — a
-- criação do índice é segura.

drop index if exists pcm.idx_sistema_itens_item;

create unique index if not exists uq_sistema_itens_item_unico
  on pcm.sistema_itens (item_id);
