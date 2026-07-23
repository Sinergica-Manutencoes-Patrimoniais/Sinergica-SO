-- 0128_E01-S83_backlog_observacao.sql — Sinérgica SO
-- Story E01-S83. Backlog (cadastro direto + origem inspeção) + campo Observação.
-- AC-4: campo de observação (texto livre) na OS/backlog.
-- AC-3: item de backlog aceita e exibe o item de inspeção de origem (pipeline completo é E01-S90 —
-- aqui só garantimos a coluna de rastreio; ninguém popula ainda).
-- FK em tabela existente: NOT VALID aqui, VALIDATE CONSTRAINT em migration separada (0129).

alter table pcm.ordens_servico
  add column if not exists observacao text;

alter table pcm.ordens_servico
  add column if not exists origem_inspecao_item_id uuid;

alter table pcm.ordens_servico
  add constraint ordens_servico_origem_inspecao_item_id_fkey
  foreign key (origem_inspecao_item_id) references pcm.inspecao_itens (id) not valid;
