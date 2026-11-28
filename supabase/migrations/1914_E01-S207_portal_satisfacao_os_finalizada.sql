-- 1914_E01-S207_portal_satisfacao_os_finalizada.sql — Sinérgica SO
-- A policy portal_satisfacao_insert (0143) exigia os.status = 'concluida', status que não existe
-- em pcm.ordens_servico (o canônico é 'finalizado'): o síndico nunca conseguia avaliar uma OS.
-- Substitui o predicado de status e, como policy nova (ADR-1691, check-revogacao-coberta), deixa
-- de confiar só no JWT: o papel e o vínculo do síndico com o Cliente são relidos ao vivo em
-- config.usuarios (ativo, papel) e config.usuario_cliente (RLS próprias: o síndico lê só a própria
-- linha). O cliente_id do JWT continua exigido, então a policy só fica MAIS estreita: síndico
-- ativo, vinculado ao Cliente do token, OS desse Cliente, created_by = auth.uid().
-- Uma avaliação por OS segue garantida pelo unique (ordem_servico_id). Aditiva.
--
-- Reverso: recriar a policy como em 0143 (status = 'concluida').

drop policy if exists "portal_satisfacao_insert" on pcm.portal_satisfacao;
create policy "portal_satisfacao_insert" on pcm.portal_satisfacao for insert to authenticated with check (
  cliente_id = nullif(auth.jwt() ->> 'cliente_id','')::uuid
  and created_by = auth.uid()
  and exists (
    select 1 from config.usuarios u
    join config.usuario_cliente uc on uc.user_id = u.user_id
    where u.user_id = auth.uid() and u.ativo and u.papel = 'cliente-sindico'
      and uc.cliente_id = portal_satisfacao.cliente_id
  )
  and exists (
    select 1 from pcm.ordens_servico os
    where os.id = ordem_servico_id
      and os.client_id = cliente_id
      and os.status = 'finalizado'
      and os.deleted_at is null
  )
);
