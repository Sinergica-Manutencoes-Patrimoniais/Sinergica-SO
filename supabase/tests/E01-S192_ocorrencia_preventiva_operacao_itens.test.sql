-- E01-S192_ocorrencia_preventiva_operacao_itens.test.sql — pgTAP (AC-9).
-- Migration 1854: pcm.operacao_itens ganha ocorrencia_preventiva_id; sso_resolver_plano_origem_os
-- resolve o nome do Plano. Prova que o Kanban passa a ter o dado pra linkar de volta ao Plano.
begin;
set local app.auvo_sync_write = 'true';
select plan(8);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('19200000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s192-pcm@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now()),
 ('19200000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s192-sem-modulo@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values
 ('19200000-0000-4000-8000-000000000001','superadmin','PCM S192',true),
 ('19200000-0000-4000-8000-000000000002','colaborador','Sem módulo S192',true);
insert into pcm.clientes(id,nome,ativo,created_by) values ('19200000-0000-4000-8000-000000000010','[TESTE] Cliente S192',true,'19200000-0000-4000-8000-000000000001');
insert into pcm.questionarios(id,auvo_id,nome,ativo) values ('19200000-0000-4000-8000-000000000026',192000026,'Questionário S192',true);
insert into pcm.tipos_tarefa(id,nome,auvo_id,created_by,updated_by) values ('19200000-0000-4000-8000-000000000027','Tipo S192',192000027,'19200000-0000-4000-8000-000000000001','19200000-0000-4000-8000-000000000001');
insert into pcm.sistemas(id,cliente_id,nome) values ('19200000-0000-4000-8000-000000000025','19200000-0000-4000-8000-000000000010','Sistema S192');
insert into pcm.planos_preventivos(id,cliente_id,sistema_id,questionario_id,tipo_tarefa_id,nome,primeira_data,intervalo_unidade,intervalo_n,created_by) values
 ('19200000-0000-4000-8000-000000000020','19200000-0000-4000-8000-000000000010','19200000-0000-4000-8000-000000000025','19200000-0000-4000-8000-000000000026','19200000-0000-4000-8000-000000000027','Plano Climatização S192','2026-01-01','meses',1,'19200000-0000-4000-8000-000000000001');
insert into pcm.ocorrencias_preventivas(id,plano_id,indice,vencimento,chave_externa) values
 ('19200000-0000-4000-8000-000000000021','19200000-0000-4000-8000-000000000020',0,'2026-11-10','teste-s192');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,status,ocorrencia_preventiva_id,created_by) values
 ('19200000-0000-4000-8000-000000000022','19200000-0000-4000-8000-000000000010','OS-S192-PREV','Inspeção','preventiva','solicitacao','19200000-0000-4000-8000-000000000021','19200000-0000-4000-8000-000000000001'),
 ('19200000-0000-4000-8000-000000000023','19200000-0000-4000-8000-000000000010','OS-S192-SEM','Vazamento','corretiva','solicitacao',null,'19200000-0000-4000-8000-000000000001');

select has_column('pcm','operacao_itens','ocorrencia_preventiva_id','AC-9: Kanban agora expõe a coluna de origem preventiva');
select is((select ocorrencia_preventiva_id from pcm.operacao_itens where ordem_servico_id='19200000-0000-4000-8000-000000000022'),'19200000-0000-4000-8000-000000000021'::uuid,'AC-9: a OS preventiva carrega o id da ocorrência de origem no Kanban');
select is((select ocorrencia_preventiva_id from pcm.operacao_itens where ordem_servico_id='19200000-0000-4000-8000-000000000023'),null,'OS corretiva (sem origem preventiva) continua null — sem falso positivo');

select set_config('request.jwt.claims','{"sub":"19200000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);
select is(pcm.sso_resolver_plano_origem_os('19200000-0000-4000-8000-000000000010','19200000-0000-4000-8000-000000000021'),'Plano Climatização S192 (legado)','AC-9: resolve o nome do Plano legado a partir da ocorrência da OS, marcado como legado');
select is(pcm.sso_resolver_plano_origem_os('19200000-0000-4000-8000-000000000010',gen_random_uuid()),null,'ocorrência inexistente devolve null, não erro — card sem Plano é informação, não defeito');

select set_config('request.jwt.claims','{"sub":"19200000-0000-4000-8000-000000000002","role":"authenticated","user_role":"colaborador"}',true);
select throws_ok($$select pcm.sso_resolver_plano_origem_os('19200000-0000-4000-8000-000000000010','19200000-0000-4000-8000-000000000021')$$,'42501',null,'usuário sem módulo pcm é recusado');

select ok(not has_function_privilege('anon','pcm.sso_resolver_plano_origem_os(uuid,uuid)','EXECUTE'),'anon não tem EXECUTE');
select ok(has_function_privilege('authenticated','pcm.sso_resolver_plano_origem_os(uuid,uuid)','EXECUTE'),'authenticated tem EXECUTE — não repete o achado de alcance no front/grant ausente');

reset role;
select * from finish();
rollback;
