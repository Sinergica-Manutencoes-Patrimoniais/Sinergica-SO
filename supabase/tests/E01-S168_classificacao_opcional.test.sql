-- Apenas fixture sintética; nada é enviado ao Auvo. Tudo é revertido.
begin;
\ir E01-S168_classificacao_opcional_fixture.sql
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(10);
update pcm.origem_campo_inbox_gate set habilitado=true where id;
update pcm.validacao_os_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
select is((pcm.sso_classificar_retorno_campo_manual('16891000-0000-4000-8000-000000000037','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000035','16891000-0000-4000-8000-000000000036','16891000-0000-4000-8000-000000000038','[{"perguntaId":"p1","resultado":"nao_inspecionado"},{"perguntaId":"p2","resultado":"nao_inspecionado"},{"perguntaId":"p3","resultado":"nao_inspecionado"},{"perguntaId":"p4","resultado":"nao_inspecionado"},{"perguntaId":"p5","resultado":"nao_inspecionado"}]')->>'coberturaComprovada')::boolean,false,'classificação não declara cobertura comprovada');
select is((select obrigatoria from pcm.respostas_os_preparadas where retorno_id='16891000-0000-4000-8000-000000000038' and chave_pergunta='p1'),false,'contrato opcional do snapshot permanece opcional');
select is((select resultado from pcm.respostas_os_preparadas where retorno_id='16891000-0000-4000-8000-000000000038' and chave_pergunta='p1'),'nao_inspecionado','ausência é preservada sem inferir OK');
select is((select obrigatoria from pcm.respostas_os_preparadas where retorno_id='16891000-0000-4000-8000-000000000038' and chave_pergunta='p2'),true,'contrato obrigatório permanece obrigatório');
select is((select obrigatoria from pcm.respostas_os_preparadas where retorno_id='16891000-0000-4000-8000-000000000038' and chave_pergunta='p3'),true,'contrato ausente mantém bloqueio conservador');
select is((select obrigatoria from pcm.respostas_os_preparadas where retorno_id='16891000-0000-4000-8000-000000000038' and chave_pergunta='p4'),true,'contratos duplicados mantêm bloqueio conservador');
select is((select obrigatoria from pcm.respostas_os_preparadas where retorno_id='16891000-0000-4000-8000-000000000038' and chave_pergunta='p5'),true,'booleano inválido mantém bloqueio conservador');
select is((pcm.sso_classificar_retorno_campo_manual('16891000-0000-4000-8000-000000000037','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000035','16891000-0000-4000-8000-000000000036','16891000-0000-4000-8000-000000000038','[{"perguntaId":"p1","resultado":"nao_inspecionado"},{"perguntaId":"p2","resultado":"nao_inspecionado"},{"perguntaId":"p3","resultado":"nao_inspecionado"},{"perguntaId":"p4","resultado":"nao_inspecionado"},{"perguntaId":"p5","resultado":"nao_inspecionado"}]')->>'retornoId'),'16891000-0000-4000-8000-000000000038','repetição devolve mesmo retorno');
select is((select count(*)::integer from pcm.respostas_os_preparadas where retorno_id='16891000-0000-4000-8000-000000000038'),5,'repetição não duplica respostas');
select ok(not has_function_privilege('authenticated','pcm.sso_classificar_retorno_campo_manual(uuid,uuid,uuid,uuid,uuid,jsonb)','execute'),'classificador continua privado');
select * from finish();
rollback;
