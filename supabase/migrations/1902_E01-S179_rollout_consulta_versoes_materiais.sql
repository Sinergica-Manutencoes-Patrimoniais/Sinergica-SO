-- 1902_E01-S179_rollout_consulta_versoes_materiais.sql — DEF-11
--
-- Reverso:
--   revoke execute on function pcm.sso_obter_linhas_materiais_vigentes(uuid,integer) from authenticated;
--   revoke execute on function pcm.sso_listar_versoes_materiais(uuid,integer,integer) from authenticated;
--
-- A migration 0411 criou as duas consultas do ADR-0185 e as deixou revogadas de todos os papéis,
-- inclusive `authenticated` — era o combinado do ADR: "RPCs revogadas até rollout". A tela de
-- organização de linhas (Workspace > "Organizar linhas") entrou chamando-as direto, sem que a
-- concessão do rollout tivesse sido emitida. Resultado em homologação: toda abertura do editor
-- responde 42501 ("permission denied for function sso_obter_linhas_materiais_vigentes") e a tela
-- mostra "Não foi possível consultar as linhas", de forma determinística — "Tentar novamente"
-- repete porque a falha é de ACL, não transitória.
--
-- Esta migration é o rollout: concede execute a `authenticated` nas duas, mantendo public, anon e
-- service_role revogados, exatamente como a 0325 já faz com pcm.sso_obter_linhas_materiais.
-- Nenhuma regra de acesso é afastada: as duas funções são `security definer` e continuam exigindo,
-- internamente, config.sso_autorizar_acao('material.gerir', cliente_id) e OS viva do mesmo cliente,
-- levantando 42501 por conta própria quando o usuário não tem a capacidade. O que muda é só o
-- direito de chamar a função — a autorização por cliente permanece inteira.
--
-- Aditiva, idempotente (grant/revoke são idempotentes), sem DDL de tabela e sem tocar em dado.

grant execute on function pcm.sso_obter_linhas_materiais_vigentes(uuid,integer) to authenticated;
revoke all on function pcm.sso_obter_linhas_materiais_vigentes(uuid,integer) from public, anon, service_role;

grant execute on function pcm.sso_listar_versoes_materiais(uuid,integer,integer) to authenticated;
revoke all on function pcm.sso_listar_versoes_materiais(uuid,integer,integer) from public, anon, service_role;
