-- E01-S167 (AC-4, atribuição direta de parcela a OS existente do mesmo Chamado, 1197) — correção
-- de bug real: `pcm.sso_os_para_parcela_direta` e `pcm.sso_atribuir_parcela_direta` nunca
-- receberam `grant execute` a `authenticated` em nenhuma migration — confirmado por grep em todo
-- o repositório. A UI real (`AtribuirParcela.tsx`) chama as duas direto no caminho
-- "chamadoDiretoId" (atribuir a uma OS já aberta do mesmo Chamado, sem passar por Backlog nem
-- criar OS nova); em qualquer ambiente real, esse caminho falharia com 42501 assim que os gates
-- fossem abertos. O caminho irmão (`sso_criar_os_parcela_direta`, cria OS nova + atribui) já foi
-- corretamente concedido em 1217 — só as duas funções mais baixas desta migration ficaram de fora.
-- Mesmo padrão de bug já corrigido em E01-S181 (1833), E01-S182 (1834) e E01-S186 (1835) nesta
-- sessão. Os gates próprios (`sso_atribuicao_direta_gate`, `sso_atribuicao_parcela_gate`) já
-- existem e já nascem fechados — este fix só concede a execução.

grant execute on function pcm.sso_os_para_parcela_direta(uuid, uuid, uuid, uuid, uuid, integer) to authenticated;
grant execute on function pcm.sso_atribuir_parcela_direta(uuid, uuid, uuid, uuid, uuid, uuid, bigint, bigint, text, timestamptz, text) to authenticated;
