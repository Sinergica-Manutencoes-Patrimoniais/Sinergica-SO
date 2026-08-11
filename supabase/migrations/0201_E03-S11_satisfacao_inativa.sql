-- 0201_E03-S11_satisfacao_inativa.sql — Sinérgica SO
-- Story E03-S11. Decisão do PO (2026-08-10): "eles não utilizam essa parte do Auvo, deixe
-- desativado, mantenha o do portal do cliente". `pcm.satisfacao_respostas` (pesquisa do Auvo,
-- E01-S55) vira espelho INATIVO — sem drop, sem alterar dado (produção confirmada com 0 linhas,
-- a pesquisa nunca foi ativada de fato). `pcm.portal_satisfacao` (CSAT/NPS do portal, E09) é a
-- fonte canônica desde já — nada muda nela.
--
-- Reverso:
--   comment on table pcm.satisfacao_respostas is null;

comment on table pcm.satisfacao_respostas is
  'E03-S11 (2026-08-11): DESATIVADA por decisão do PO — a Sinérgica não usa a pesquisa de '
  'satisfação do Auvo. Espelho inativo, sem novas escritas (a Edge Function '
  'pcm-auvo-support-pull não aceita mais resource=satisfactions). Fonte canônica de CSAT/NPS é '
  'pcm.portal_satisfacao (respondida pelo síndico no portal, E09). Reativar: reintroduzir '
  '''satisfactions'' no union type Resource e na lista de recursos chamados por '
  'pcm-auvo-sync-all — decisão de produto, não recriação de schema.';
