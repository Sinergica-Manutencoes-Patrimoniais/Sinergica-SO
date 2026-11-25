-- 1882_E02-S25_revogacao_coberta_janela_automatica.sql — Sinérgica SO
-- Story E02-S25, correção de segurança apontada pelo gate `check-revogacao-coberta` (ADR-1691).
--
-- As duas policies que a 1881 criou em `atendimento.persona_janela_automatica` decidiam SÓ pelo
-- `auth.jwt()`. O JWT é um carimbo do momento do login: revogar o acesso de alguém não surte
-- efeito nenhum até o token expirar — a sessão aberta continua lendo e escrevendo. É exatamente
-- a exposição que a E00-S27 fechou, e o padrão que o 0234 (E01-S184) já tinha estabelecido.
--
-- A correção é trocar a condição por `config.sso_acesso_atual('atendimento', ...)`, que relê
-- `config.usuarios` + `resolver_permissoes_modulo` AO VIVO a cada linha. A função já cobre o
-- superadmin e já exige `u.ativo`, então a condição inteira cabe nela — o `auth.jwt()` sai de
-- cena em vez de virar um "ou" que reabriria o mesmo buraco pelo outro lado.
--
-- POR QUE ESTA MIGRATION EXISTE **E** A 1881 TAMBÉM FOI CORRIGIDA
-- O gate `scripts/check-revogacao-coberta.mjs` lê o TEXTO das migrations, não o estado do banco:
-- ele varre todo arquivo com número >= 1855 e reprova qualquer bloco `create policy` que cite
-- `auth.jwt() ->> 'user_role'` sem uma função de releitura ao vivo no MESMO bloco. Uma migration
-- posterior que troque a policy não apaga o texto da anterior, então, enquanto a 1881 contivesse
-- a versão antiga, o gate continuaria vermelho — não há waiver nem allowlist no script.
-- Por isso a correção foi feita nos dois lugares:
--   • na 1881, que ainda NÃO foi aplicada em produção (está só nesta branch, e a CI aplica o
--     diretório inteiro do zero) — é lá que a policy nasce certa;
--   • aqui, para convergir qualquer banco onde a 1881 ANTIGA já tenha rodado (os bancos locais
--     compartilhados desta rodada rodaram). `drop policy` + `create policy` por nome, numa
--     migration transacional: a tabela nunca fica sem RLS, porque `enable`/`force row level
--     security` seguem valendo o tempo todo.
--
-- Reverso: não há reverso desejável — voltar ao texto anterior reabre a cegueira à revogação
-- (SEC-004/SEC-007). Para remover a tabela inteira, use o reverso documentado na 1881.

drop policy if exists "persona_janela_automatica_select" on atendimento.persona_janela_automatica;
drop policy if exists "persona_janela_automatica_escrita" on atendimento.persona_janela_automatica;

create policy "persona_janela_automatica_select" on atendimento.persona_janela_automatica
  for select to authenticated
  using (config.sso_acesso_atual('atendimento', 'leitura'));

create policy "persona_janela_automatica_escrita" on atendimento.persona_janela_automatica
  for all to authenticated
  using (config.sso_acesso_atual('atendimento', 'escrita'))
  with check (config.sso_acesso_atual('atendimento', 'escrita'));

-- Os GRANTs da 1881 continuam valendo (RLS só é avaliada depois do privilégio de tabela); esta
-- migration não mexe neles.

-- ── Verificação (rode após aplicar) ───────────────────────────────────────────────────────────
-- select polname, pg_get_expr(polqual, polrelid) from pg_policy
--  where polrelid = 'atendimento.persona_janela_automatica'::regclass;
-- node scripts/check-revogacao-coberta.mjs
