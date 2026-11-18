-- E01-S196 AC-9/AC-10/AC-11 — contingência auditada do caminho manual de criação de tarefa Auvo.
begin;
set local app.auvo_sync_write = 'true';
select plan(16);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('19600000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s196-contingencia@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now()),
 ('19600000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s196-so-modulo@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values
 ('19600000-0000-4000-8000-000000000001','superadmin','Contingência S196',true),
 ('19600000-0000-4000-8000-000000000002','colaborador','Só módulo S196',true);
insert into pcm.clientes(id,nome,ativo,created_by) values ('19600000-0000-4000-8000-000000000010','[TESTE] Cliente S196',true,'19600000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('19600000-0000-4000-8000-000000000001','execucao.contingencia_auvo','19600000-0000-4000-8000-000000000010');
-- "Só módulo" tem escrita no pcm (via perfil) mas NENHUMA concessão de execucao.contingencia_auvo
-- — prova que o achado desta story (módulo genérico não bastava) está realmente fechado.
insert into config.sso_perfis(id,nome,ativo) values ('19600000-0000-4000-8000-000000000030','Perfil PCM escrita S196',true);
insert into config.sso_concessoes(perfil_id,acao,cliente_id) values ('19600000-0000-4000-8000-000000000030','cadastro.gerir','19600000-0000-4000-8000-000000000010');
insert into config.sso_usuario_perfis(usuario_id,perfil_id,ativo) values ('19600000-0000-4000-8000-000000000002','19600000-0000-4000-8000-000000000030',true);
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,status,created_by) values
 ('19600000-0000-4000-8000-000000000020','19600000-0000-4000-8000-000000000010','OS-S196','Abertura manual','corretiva','planejamento','19600000-0000-4000-8000-000000000001');

select set_config('request.jwt.claims','{"sub":"19600000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);

select is(pcm.sso_autorizar_contingencia_auvo('19600000-0000-4000-8000-000000000010'),true,'AC-10: usuário com concessão é autorizado (checagem isolada, pré-UI)');
select is(
  pcm.sso_registrar_contingencia_auvo('19600000-0000-4000-8000-000000000040','19600000-0000-4000-8000-000000000010','19600000-0000-4000-8000-000000000020','Auvo fora do ar, PCM abriu manualmente pra não atrasar a visita')::text is not null,
  true,
  'AC-9: contingência registrada com motivo'
);
select is(
  (select count(*)::int from audit.events where action='execucao.contingencia_auvo_usada' and entity_id='19600000-0000-4000-8000-000000000020'::uuid),
  1,
  'AC-9: evento auditado em audit.events'
);
select is(
  (select motivo from pcm.sso_contingencias_auvo where request_id='19600000-0000-4000-8000-000000000040'),
  'Auvo fora do ar, PCM abriu manualmente pra não atrasar a visita',
  'motivo persistido tal qual'
);

-- Replay idempotente: mesmo request_id, mesmo payload, não duplica linha nem evento de auditoria.
select is(
  pcm.sso_registrar_contingencia_auvo('19600000-0000-4000-8000-000000000040','19600000-0000-4000-8000-000000000010','19600000-0000-4000-8000-000000000020','Auvo fora do ar, PCM abriu manualmente pra não atrasar a visita')::text,
  (select id::text from pcm.sso_contingencias_auvo where request_id='19600000-0000-4000-8000-000000000040'),
  'replay devolve o mesmo id'
);
select is((select count(*)::int from pcm.sso_contingencias_auvo),1,'replay não duplica linha');
select is((select count(*)::int from audit.events where action='execucao.contingencia_auvo_usada'),1,'replay não duplica auditoria');
select throws_ok(
  $$select pcm.sso_registrar_contingencia_auvo('19600000-0000-4000-8000-000000000040','19600000-0000-4000-8000-000000000010','19600000-0000-4000-8000-000000000020','Motivo diferente do que foi gravado')$$,
  '23505',
  'request_conflitante',
  'replay com payload divergente é recusado'
);
select throws_ok(
  $$select pcm.sso_registrar_contingencia_auvo('19600000-0000-4000-8000-000000000041','19600000-0000-4000-8000-000000000010','19600000-0000-4000-8000-000000000020','')$$,
  '22023',
  'contingencia_invalida',
  'motivo vazio é recusado — não é "informe algo", é obrigatório ter conteúdo'
);
select is(
  (select count(*)::int from pcm.sso_listar_contingencias_auvo('19600000-0000-4000-8000-000000000010',null,30)),
  1,
  'AC-11: leitura consolidada das contingências usadas por Cliente'
);

select set_config('request.jwt.claims','{"sub":"19600000-0000-4000-8000-000000000002","role":"authenticated","user_role":"colaborador"}',true);

select is(
  pcm.sso_autorizar_contingencia_auvo('19600000-0000-4000-8000-000000000010'),
  false,
  'AC-10: usuário sem a capacidade própria é negado — mesmo tendo módulo pcm escrita via perfil'
);
select throws_ok(
  $$select pcm.sso_registrar_contingencia_auvo('19600000-0000-4000-8000-000000000042','19600000-0000-4000-8000-000000000010','19600000-0000-4000-8000-000000000020','Tentativa sem capacidade')$$,
  '42501',
  'sem_acesso',
  'AC-10: registro é recusado no servidor, não só escondido na UI — módulo genérico não basta'
);
select throws_ok(
  $$select pcm.sso_listar_contingencias_auvo('19600000-0000-4000-8000-000000000010',null,30)$$,
  '42501',
  'sem_acesso',
  'leitura também exige a capacidade própria'
);

select ok(not has_function_privilege('anon','pcm.sso_autorizar_contingencia_auvo(uuid)','EXECUTE'),'anon não tem EXECUTE na checagem');
select ok(not has_function_privilege('anon','pcm.sso_registrar_contingencia_auvo(uuid,uuid,uuid,text)','EXECUTE'),'anon não tem EXECUTE no registro');
select ok(not has_table_privilege('authenticated','pcm.sso_contingencias_auvo','SELECT'),'authenticated não lê a tabela direto — só pela RPC (padrão porta única)');

select * from finish();
rollback;
