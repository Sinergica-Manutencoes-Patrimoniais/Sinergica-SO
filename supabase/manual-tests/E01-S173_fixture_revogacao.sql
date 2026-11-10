-- APENAS banco de teste descartável, restaurado com schema e sem dados reais/cron.
-- Comita fixture sintética para permitir duas sessões; descarte o banco após os testes.
begin;
insert into config.sso_acoes(codigo,modulo,nivel,exige_concessao_individual) values ('execucao.validar','pcm','escrita',false);
insert into pcm.validacao_os_gate(id,habilitado) values(true,true);
insert into pcm.sso_revisao_validacao_os_gate(id,habilitado) values(true,true);
insert into pcm.sso_condicao_retorno_gate(id,habilitado) values(true,true);
insert into pcm.sso_pendencias_gate(id,habilitado) values(true,true);
\ir ../tests/E01-S173_retorno_aprovado_fixture.sql
update pcm.sso_mediacao_pendencias_retorno_gate set habilitado=true where id;
commit;
