-- 0137_E01-S90_inspecao_assessment.sql — Sinérgica SO
-- Story E01-S90. Inspeção vira documento de assessment do cliente (D1 design.md): estende
-- `pcm.inspecoes`/`pcm.inspecao_itens` (mesma mecânica de itens+foto já existente, E01-S73) em vez
-- de criar tabelas novas — reduz risco e reusa RLS/grants já validados.
--
-- D2: cada resposta do questionário Auvo vira 1 item (idempotente por inspeção+questão) —
-- `auvo_questao_chave` + índice único parcial.
-- D3: item deriva Chamado/Backlog/OS com responsável — `destino`/`destino_responsavel`. O vínculo
-- item→entidade derivada fica na entidade derivada, não aqui: mesmo padrão já usado em
-- `pcm.ordens_servico.origem_inspecao_item_id` (0128/0129, ainda sem consumidor até agora) —
-- replicado aqui em `pcm.chamados.origem_inspecao_item_id` pra simetria (Chamado também pode
-- nascer de um item de assessment, E01-S88 já previa `origem = 'inspecao'`).

alter table pcm.inspecoes add column if not exists e_assessment boolean not null default false;
alter table pcm.inspecoes add column if not exists motivo_assessment text
  check (motivo_assessment in ('inicio', 'alteracao_contrato', 'anual'));

alter table pcm.inspecao_itens add column if not exists destino text
  check (destino in ('chamado', 'backlog', 'os'));
alter table pcm.inspecao_itens add column if not exists destino_responsavel text
  check (destino_responsavel in ('sinergica', 'terceiro', 'cliente'));
-- Chave estável da questão dentro do questionário Auvo (D2) — garante idempotência ao reprocessar
-- o mesmo snapshot sem duplicar itens.
alter table pcm.inspecao_itens add column if not exists auvo_questao_chave text;

create unique index if not exists uq_inspecao_itens_questao
  on pcm.inspecao_itens (inspecao_id, auvo_questao_chave)
  where auvo_questao_chave is not null;

-- Squawk: FK direto na ALTER ADD COLUMN faz scan+lock — NOT VALID aqui, VALIDATE em 0138 (mesmo
-- padrão de 0128/0129, 0134/0135).
alter table pcm.chamados add column if not exists origem_inspecao_item_id uuid;
alter table pcm.chamados add constraint chamados_origem_inspecao_item_id_fkey
  foreign key (origem_inspecao_item_id) references pcm.inspecao_itens (id) not valid;
