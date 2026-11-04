-- Somente clone isolado de schema sem dados reais, cron ou rede; será descartado.
begin;
insert into config.sso_acoes(codigo,modulo,nivel,exige_concessao_individual) values ('execucao.validar','pcm','escrita',false);
insert into pcm.origem_campo_inbox_gate(id,habilitado) values(true,true);
insert into pcm.validacao_os_gate(id,habilitado) values(true,true);
insert into pcm.sso_conferencia_cobertura_retorno_gate(id,habilitado) values(true,true);
insert into pcm.sso_upload_evidencia_resposta_gate(id,habilitado) values(true,true);
insert into pcm.sso_validacao_resposta_gate(id,habilitado) values(true,true);
insert into pcm.sso_revisao_validacao_os_gate(id,habilitado) values(true,true);
insert into pcm.sso_condicao_retorno_gate(id,habilitado) values(true,true);
insert into pcm.sso_condicao_evidencia_gate(id,habilitado) values(true,true);
insert into pcm.sso_atestacao_pcm_gate(id,habilitado) values(true,true);
insert into pcm.sso_pendencias_gate(id,habilitado) values(true,true);
\ir ../tests/E01-S168_opcional_aprovacao_fixture.sql
set local request.jwt.claims='{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
select pcm.sso_classificar_retorno_campo_manual('16891000-0000-4000-8000-000000000037','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000035','16891000-0000-4000-8000-000000000036','16891000-0000-4000-8000-000000000038','[{"perguntaId":"p1","resultado":"nao_inspecionado"},{"perguntaId":"p2","resultado":"nao_ok"}]');
select pcm.sso_conferir_cobertura_retorno('16891000-0000-4000-8000-000000000040','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000038',null,0,'Conferência sintética');
commit;
