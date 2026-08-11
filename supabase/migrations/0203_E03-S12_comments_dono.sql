-- 0203_E03-S12_comments_dono.sql — Sinérgica SO
-- Story E03-S12 (AC-1). Documenta o dono do "Fluxo B" (Orçamento de Serviço extra-contratual):
-- `pcm.requisicoes_servico`/`orcamentos_servico`/`orcamento_decisoes` nasceram na E09-S09
-- (migration 0144) sem que o ROADMAP registrasse — a E01-S14 ficou "bloqueada" por mais de um mês
-- com o código já em produção. Decisão 10 do épico E03 (design.md §5.1): o PCM é dono legítimo
-- (R1) — Orçamento de Serviço é extra-contratual sobre um cliente ativo e gera OS, distinto da
-- Proposta comercial (pré-venda, gera contrato, mora no Comercial). O portal é canal de escrita
-- (via `pcm.portal_decidir_orcamento`) e de leitura (via `pcm.portal_orcamentos_servico`,
-- migration 0202), nunca dono.
--
-- Reverso:
--   comment on table pcm.requisicoes_servico is null;
--   comment on table pcm.orcamentos_servico is null;
--   comment on table pcm.orcamento_decisoes is null;

comment on table pcm.requisicoes_servico is
  'E03-S12: dono é o PCM (R1, decisão 10 do épico E03) — Orçamento de Serviço é extra-contratual '
  '(cliente ativo, gera OS), distinto de Proposta comercial (pré-venda, gera contrato, '
  'comercial.propostas). Origem: E09-S09 (migration 0144), fecha a E01-S14. Portal do cliente é '
  'canal de escrita/decisão via pcm.portal_decidir_orcamento, nunca dono.';

comment on table pcm.orcamentos_servico is
  'E03-S12: dono é o PCM (R1, decisão 10 do épico E03) — Orçamento de Serviço é extra-contratual '
  '(cliente ativo, gera OS), distinto de Proposta comercial (pré-venda, gera contrato, '
  'comercial.propostas). Origem: E09-S09 (migration 0144), fecha a E01-S14. Leitura pelo portal '
  'via pcm.portal_orcamentos_servico (migration 0202, R2) — nunca select direto da tabela-base.';

comment on table pcm.orcamento_decisoes is
  'E03-S12: dono é o PCM (R1, decisão 10 do épico E03) — decisão (aprovar/recusar) do síndico '
  'sobre um pcm.orcamentos_servico, append-only. Origem: E09-S09 (migration 0144), fecha a '
  'E01-S14. Gravada só via pcm.portal_decidir_orcamento (security definer).';
