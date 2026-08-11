-- 0204_E03-S13_comment_dono_snapshots.sql — Sinérgica SO
-- Story E03-S13. `atendimento.historico_chamado_snapshots` foi criada pela E01-S89 (épico do
-- PCM), o que levou a auditoria de 2026-08-10 a classificá-la como violação de R1 ("criada pelo
-- PCM"). Ao ler a migration de origem (0136), a classificação se mostrou errada: ela já declarava
-- e justificava a escolha — "tabela vive no schema de quem PRODUZ o dado (atendimento), com FK
-- direta pro schema pcm". O snapshot É conversa de WhatsApp, dado do Atendimento anexado a um
-- Chamado do PCM. Pelo R1 (dono = quem produz o dado e governa seu ciclo de vida), o Atendimento
-- é dono e o schema estava certo desde o início — épico de origem da story não determina
-- propriedade (ADR-0019, corolário). Classificação revogada. Sem mudança de schema, RLS ou
-- comportamento — só documentação (AC-4).
--
-- Reverso:
--   comment on table atendimento.historico_chamado_snapshots is null;

comment on table atendimento.historico_chamado_snapshots is
  'E03-S13: dono é o Atendimento (R1) — snapshot de conversa de WhatsApp anexado a um Chamado do '
  'PCM. Criada pela E01-S89 (épico do PCM), mas épico de origem não determina propriedade '
  '(ADR-0019, corolário). Classificação de "violação de R1" da auditoria de 2026-08-10 foi '
  'revogada — a migration de origem já justificava a escolha de schema corretamente. Leitura '
  'cross-schema pelo PCM (supabase-chamados-adapter.ts) é consumo aceito, sob RLS própria — não '
  'precisa de view (R2) enquanto a leitura for simples.';
