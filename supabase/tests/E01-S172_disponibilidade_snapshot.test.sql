begin;
select plan(10);
-- Fixtures locais nunca devem enfileirar nem disparar integração externa.
set local app.auvo_sync_write = 'true';
create temporary table s172_outbox_antes as select count(*) as total from pcm.auvo_sync_outbox;
select ok(has_function_privilege('authenticated','pcm.sso_snapshot_capacidade_autorizado(uuid,date,integer)','execute'),'snapshot v4 mediado disponível');
select ok(not has_function_privilege('anon','pcm.sso_snapshot_capacidade_autorizado(uuid,date,integer)','execute'),'anônimo não consulta');
select throws_ok($$select pcm.sso_snapshot_capacidade_autorizado(null,null,4)$$,'55000','esforco_capacidade_bloqueado','gates das fontes continuam necessários');
select is((select provolatile::text from pg_proc where oid='pcm.sso_mediar_snapshot_capacidade_v4(uuid,date)'::regprocedure),'s','disponibilidade e demanda compartilham snapshot');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 values('17294000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s172-snapshot@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('17294000-0000-4000-8000-000000000001','superadmin','Snapshot sintético',true);
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('17294000-0000-4000-8000-000000000002','Cliente sintético A',true,'17294000-0000-4000-8000-000000000001'),
 ('17294000-0000-4000-8000-000000000003','Cliente sintético B',true,'17294000-0000-4000-8000-000000000001');
insert into pcm.funcionarios(id,nome,ativo) values ('17294000-0000-4000-8000-000000000004','Técnico A',true),('17294000-0000-4000-8000-000000000005','Técnico B',true);
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('17294000-0000-4000-8000-000000000001','capacidade.gerir','17294000-0000-4000-8000-000000000002'),
 ('17294000-0000-4000-8000-000000000001','plano.gerir','17294000-0000-4000-8000-000000000002');
insert into pcm.capacidade_disponibilidades(id,cliente_id,funcionario_id,semana_inicio,destinados_minutos,reservas_minutos,ausencias_minutos,created_by,updated_by) values
 ('17294000-0000-4000-8000-000000000010','17294000-0000-4000-8000-000000000002','17294000-0000-4000-8000-000000000004','2026-10-26',600,60,30,'17294000-0000-4000-8000-000000000001','17294000-0000-4000-8000-000000000001'),
 ('17294000-0000-4000-8000-000000000011','17294000-0000-4000-8000-000000000002','17294000-0000-4000-8000-000000000005','2026-10-26',300,0,0,'17294000-0000-4000-8000-000000000001','17294000-0000-4000-8000-000000000001'),
 ('17294000-0000-4000-8000-000000000012','17294000-0000-4000-8000-000000000003','17294000-0000-4000-8000-000000000004','2026-10-26',999,0,0,'17294000-0000-4000-8000-000000000001','17294000-0000-4000-8000-000000000001');
update pcm.capacidade_esforco_declarado_gate set habilitado=true where id;
update pcm.capacidade_fontes_mediacao_gate set habilitado=true where id;
update pcm.capacidade_demanda_gate set habilitado=true where id;
update pcm.sso_fila_obrigacoes_preparadas_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"17294000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select is(jsonb_array_length(pcm.sso_snapshot_capacidade_autorizado('17294000-0000-4000-8000-000000000002','2026-10-26',4)->'disponibilidades'),2,'somente disponibilidade do Cliente e semana');
select is(pcm.sso_snapshot_capacidade_autorizado('17294000-0000-4000-8000-000000000002','2026-10-26',4)->'disponibilidades'->0->>'destinados_minutos','600','horas destinadas preservadas');
select is(pcm.sso_snapshot_capacidade_autorizado('17294000-0000-4000-8000-000000000002','2026-10-26',4)->'disponibilidades'->0->>'reservas_minutos','60','reserva preservada sem provar sobreposição');
select is(pcm.sso_snapshot_capacidade_autorizado('17294000-0000-4000-8000-000000000002','2026-10-26',4)->>'completude','desconhecida','cobertura não afirmada');
select throws_ok($$select pcm.sso_snapshot_capacidade_autorizado('17294000-0000-4000-8000-000000000003','2026-10-26',4)$$,'42501','capacidade_nao_encontrada_ou_sem_acesso','outro Cliente sem concessão negado');
reset role;
select is((select count(*) from pcm.auvo_sync_outbox),(select total from s172_outbox_antes),'fixtures não enfileiram Auvo');
select * from finish();
rollback;
