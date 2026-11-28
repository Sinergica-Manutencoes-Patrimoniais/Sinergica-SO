-- 1914_E01-S207_portal_satisfacao_os_finalizada.sql — Sinérgica SO
-- A policy portal_satisfacao_insert (0143) exigia os.status = 'concluida', status que não existe
-- em pcm.ordens_servico (o canônico é 'finalizado'): o síndico nunca conseguia avaliar uma OS.
-- Substitui só o predicado de status; quem pode inserir não muda (síndico do próprio Cliente,
-- OS desse Cliente, created_by = auth.uid()). Uma avaliação por OS segue garantida pelo unique
-- (ordem_servico_id) da tabela. Aditiva: nenhuma tabela/dado alterado.
--
-- Reverso: recriar a policy com os.status = 'concluida' (0143).

drop policy if exists "portal_satisfacao_insert" on pcm.portal_satisfacao;
create policy "portal_satisfacao_insert" on pcm.portal_satisfacao for insert to authenticated with check (
  auth.jwt() ->> 'user_role' = 'cliente-sindico'
  and cliente_id = nullif(auth.jwt() ->> 'cliente_id','')::uuid
  and created_by = auth.uid()
  and exists (
    select 1 from pcm.ordens_servico os
    where os.id = ordem_servico_id
      and os.client_id = cliente_id
      and os.status = 'finalizado'
      and os.deleted_at is null
  )
);
