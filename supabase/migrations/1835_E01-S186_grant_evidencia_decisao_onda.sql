-- E01-S186 — correção de bug real encontrado ao escrever pgTAP de verdade: `pcm.sso_registrar_evidencia_onda`
-- (1092) e `pcm.sso_registrar_decisao_onda` (1104) nunca receberam `grant execute` a `authenticated`
-- em nenhuma migration — confirmado por grep em todo o repositório. A UI real
-- (`application/registrar-evidencia-onda.ts`/`application/decisao-onda.ts`, consumidas por
-- `RegistrarEvidenciaOnda.tsx`/`DecisaoOnda.tsx`) chama essas RPCs direto; em qualquer ambiente real,
-- registrar evidência OU decisão de onda falharia com 42501 assim que os gates fossem abertos —
-- a própria ferramenta de homologação do programa (S186) estaria quebrada no momento de usá-la.
-- Mesmo padrão de bug já encontrado e corrigido em E01-S167 (1831), E01-S181 (1833) e E01-S182
-- (1834) nesta sessão. Os gates próprios de cada função (`sso_evidencias_ondas_gate`,
-- `sso_decisao_onda_gate`) já existem e já nascem fechados — este fix só concede a execução.
--
-- Reverso:
--   revoke execute on function pcm.sso_registrar_evidencia_onda(uuid,uuid,smallint,integer,text,text,text,timestamptz,text,text[],text[],text) from authenticated;
--   revoke execute on function pcm.sso_registrar_decisao_onda(uuid,uuid,smallint,integer,text,text,jsonb,text) from authenticated;

grant execute on function pcm.sso_registrar_evidencia_onda(uuid,uuid,smallint,integer,text,text,text,timestamptz,text,text[],text[],text) to authenticated;
grant execute on function pcm.sso_registrar_decisao_onda(uuid,uuid,smallint,integer,text,text,jsonb,text) to authenticated;
