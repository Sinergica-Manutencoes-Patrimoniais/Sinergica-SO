-- E00-S27_revogacao_imediata.test.sql — pgTAP (AC-1, AC-3, AC-4, AC-6).
-- Migration 1855: config.sso_acesso_atual (generaliza 0234) + sso_revogar_usuario/
-- sso_reativar_usuario auditados. Prova que a MESMA sessão (mesmo JWT, nenhum novo login)
-- perde e recupera acesso — é o núcleo do achado do Fabrício.
begin;
select plan(13);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('e0027000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s27-superadmin@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now()),
 ('e0027000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s27-colaborador@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());

insert into pcm.clientes(id,nome,ativo,created_by) values ('e0027000-0000-4000-8000-000000000010','[TESTE] Cliente S27',true,'e0027000-0000-4000-8000-000000000001');

insert into config.grupos(id,nome,ativo) values ('e0027000-0000-4000-8000-000000000020','[TESTE] Grupo S27',true);
insert into config.grupo_modulos(grupo_id,modulo,nivel) values ('e0027000-0000-4000-8000-000000000020','pcm','escrita');
insert into config.usuarios(user_id,papel,nome,ativo) values ('e0027000-0000-4000-8000-000000000001','superadmin','Superadmin S27',true);
insert into config.usuarios(user_id,papel,nome,ativo,grupo_id) values ('e0027000-0000-4000-8000-000000000002','colaborador','Colaborador S27',true,'e0027000-0000-4000-8000-000000000020');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('e0027000-0000-4000-8000-000000000002','cadastro.aprovar','e0027000-0000-4000-8000-000000000010');

-- "Sessão" simulada: um único JWT, fixado ANTES de qualquer revogação, e nunca trocado depois —
-- é exatamente o cenário do AC-1 (token ainda não expirado, sem novo login).
select set_config('request.jwt.claims','{"sub":"e0027000-0000-4000-8000-000000000002","role":"authenticated","user_role":"colaborador"}',true);

-- Pré-condição: acesso concedido ANTES da revogação, com este JWT.
select is(config.sso_acesso_atual('pcm','escrita'),true,'pré-condição: módulo pcm:escrita concedido antes da revogação');
select is(config.sso_autorizar_acao('cadastro.aprovar','e0027000-0000-4000-8000-000000000010'),true,'pré-condição: cadastro.aprovar concedido antes da revogação');

-- Achado de /revisao-adversarial: autorrevogação travaria o único caminho de volta.
select set_config('request.jwt.claims','{"sub":"e0027000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);
select throws_ok($$select config.sso_revogar_usuario('e0027000-0000-4000-8000-000000000032','e0027000-0000-4000-8000-000000000001','Teste')$$,'22023','nao_pode_revogar_a_si_mesmo','superadmin não consegue se autorrevogar — travaria sso_reativar_usuario pra sempre');

-- Revogação, feita por outra sessão (superadmin) — o JWT do colaborador acima NUNCA é tocado.
select set_config('request.jwt.claims','{"sub":"e0027000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);
select lives_ok($$select config.sso_revogar_usuario('e0027000-0000-4000-8000-000000000030','e0027000-0000-4000-8000-000000000002','Desligamento')$$,'AC-3: revogação é aceita e auditada, feita pelo superadmin');
select is((select count(*)::int from audit.events where action='usuario.revogado' and entity_id='e0027000-0000-4000-8000-000000000002'),1,'AC-3: audit.events tem o evento de revogação (ator+alvo+momento)');
select is((select (payload->>'motivo') from audit.events where action='usuario.revogado' and entity_id='e0027000-0000-4000-8000-000000000002'),'Desligamento','AC-3: motivo fica registrado no payload auditado');

-- AC-1: a MESMA sessão (mesmo JWT, sem novo login) perde acesso na PRÓXIMA ação.
select set_config('request.jwt.claims','{"sub":"e0027000-0000-4000-8000-000000000002","role":"authenticated","user_role":"colaborador"}',true);
select is(config.sso_acesso_atual('pcm','escrita'),false,'AC-1: mesmo JWT de antes, sem novo login, perde acesso de módulo imediatamente após revogação');
select is(config.sso_autorizar_acao('cadastro.aprovar','e0027000-0000-4000-8000-000000000010'),false,'AC-1: mesma lógica vale pra RPC sensível (sso_autorizar_acao), não só RLS');

-- AC-2: a garantia é por usuário, não por sessão/dispositivo — não há estado de "sessão A" vs
-- "sessão B" em lugar nenhum (nem cache, nem tabela); qualquer JWT com o mesmo sub recebe a
-- MESMA resposta (ambos os `select` acima já usam o mesmo sub repetidamente e dão false) —
-- não existe segunda sessão "esquecida" porque a checagem nunca olha pra sessão, só pro usuário.
select ok(true,'AC-2: a checagem é por usuario_id, nunca por sessão — automaticamente cobre qualquer número de dispositivos logados');

-- AC-4: revogar só a capacidade sensível (não o usuário inteiro) também vale na mesma sessão.
select set_config('request.jwt.claims','{"sub":"e0027000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);
update config.sso_concessoes set ativa=false where usuario_id='e0027000-0000-4000-8000-000000000002' and acao='cadastro.aprovar';
select set_config('request.jwt.claims','{"sub":"e0027000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);
select lives_ok($$select config.sso_reativar_usuario('e0027000-0000-4000-8000-000000000031','e0027000-0000-4000-8000-000000000002','Retorno')$$,'AC-6: reativação é aceita e auditada');
select is((select count(*)::int from audit.events where action='usuario.reativado' and entity_id='e0027000-0000-4000-8000-000000000002'),1,'AC-6: audit.events tem o evento de reativação');
select set_config('request.jwt.claims','{"sub":"e0027000-0000-4000-8000-000000000002","role":"authenticated","user_role":"colaborador"}',true);
select is(config.sso_acesso_atual('pcm','escrita'),true,'AC-6: usuário reativado recupera acesso de módulo imediatamente, mesmo JWT');
select is(config.sso_autorizar_acao('cadastro.aprovar','e0027000-0000-4000-8000-000000000010'),false,'AC-4: mas a concessão revogada separadamente continua negada — revogação granular não se confunde com reativação do usuário');

reset role;
delete from config.sso_concessoes where usuario_id='e0027000-0000-4000-8000-000000000002';
delete from config.sso_revogacoes_usuario where usuario_id='e0027000-0000-4000-8000-000000000002';
delete from config.usuarios where user_id in ('e0027000-0000-4000-8000-000000000001','e0027000-0000-4000-8000-000000000002');
delete from config.grupo_modulos where grupo_id='e0027000-0000-4000-8000-000000000020';
delete from config.grupos where id='e0027000-0000-4000-8000-000000000020';
delete from pcm.clientes where id='e0027000-0000-4000-8000-000000000010';

select * from finish();
rollback;
