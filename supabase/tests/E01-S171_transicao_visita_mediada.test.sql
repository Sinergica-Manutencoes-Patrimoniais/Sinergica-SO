begin;
set local app.auvo_sync_write='true';
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
set local timezone='UTC';
select plan(17);
select has_function('pcm','sso_transicionar_visita_mediada',array['uuid','uuid','integer','text','timestamp with time zone','timestamp with time zone','text'],'entrada mediada existe');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('17199000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','transicao-171@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values('17199000-0000-4000-8000-000000000001','superadmin','Operador sintético',true);
insert into pcm.clientes(id,nome,created_by) values
('17199000-0000-4000-8000-000000000002','Cliente A','17199000-0000-4000-8000-000000000001'),
('17199000-0000-4000-8000-000000000003','Cliente B','17199000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
('17199000-0000-4000-8000-000000000001','visita.confirmar','17199000-0000-4000-8000-000000000002');
insert into pcm.visitas(id,cliente_id,inicio_em,fim_em,fuso,natureza,estado,created_by) values
('17199000-0000-4000-8000-000000000011','17199000-0000-4000-8000-000000000002','2026-11-02 12:00+00','2026-11-02 13:00+00','America/Sao_Paulo','regular','confirmada','17199000-0000-4000-8000-000000000001'),
('17199000-0000-4000-8000-000000000012','17199000-0000-4000-8000-000000000003','2026-11-02 12:00+00','2026-11-02 13:00+00','America/Sao_Paulo','extra','planejada','17199000-0000-4000-8000-000000000001'),
('17199000-0000-4000-8000-000000000013','17199000-0000-4000-8000-000000000002','2026-11-02 12:00+00','2026-11-02 13:00+00','America/Sao_Paulo','extra','planejada','17199000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,auvo_task_id,created_by) values
('17199000-0000-4000-8000-000000000014','17199000-0000-4000-8000-000000000002','S171-REMOTE','OS com efeito remoto','corretiva',123456,'17199000-0000-4000-8000-000000000001');
insert into pcm.visita_ordens_servico(id,visita_id,os_id,cliente_id,sequencia,created_by) values
('17199000-0000-4000-8000-000000000015','17199000-0000-4000-8000-000000000013','17199000-0000-4000-8000-000000000014','17199000-0000-4000-8000-000000000002',1,'17199000-0000-4000-8000-000000000001');
set local request.jwt.claims='{"sub":"17199000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok($$select pcm.sso_transicionar_visita_mediada('17199000-0000-4000-8000-000000000021','17199000-0000-4000-8000-000000000011',1,'reprogramar','2026-11-09 12:00+00','2026-11-09 13:00+00','Reprogramar')$$,'55000','transicao_visita_bloqueada','gate fechado bloqueia');
reset role;
update pcm.visita_transicao_gate set habilitado=true where id;
set local role authenticated;
select is((pcm.sso_transicionar_visita_mediada('17199000-0000-4000-8000-000000000021','17199000-0000-4000-8000-000000000011',1,'reprogramar','2026-11-09 12:00+00','2026-11-09 13:00+00','Reprogramar')->>'revision')::integer,2,'reprograma revisão autorizada');
set local timezone='America/Sao_Paulo';
select lives_ok($$select pcm.sso_transicionar_visita_mediada('17199000-0000-4000-8000-000000000021','17199000-0000-4000-8000-000000000011',1,'reprogramar','2026-11-09 12:00+00','2026-11-09 13:00+00','Reprogramar')$$,'replay mantém identidade entre fusos');
select is(current_setting('timezone'),'America/Sao_Paulo','fuso do chamador preservado');
set local timezone='UTC';
select is((pcm.sso_transicionar_visita_mediada('17199000-0000-4000-8000-000000000021','17199000-0000-4000-8000-000000000011',1,'reprogramar','2026-11-09 12:00+00','2026-11-09 13:00+00','Reprogramar')->>'revision')::integer,2,'replay devolve mesmo resultado');
select throws_ok($$select pcm.sso_transicionar_visita_mediada('17199000-0000-4000-8000-000000000021','17199000-0000-4000-8000-000000000011',1,'reprogramar','2026-11-10 12:00+00','2026-11-10 13:00+00','Reprogramar')$$,'23505','request_id_conflitante','request divergente recusado');
select throws_ok($$select pcm.sso_transicionar_visita_mediada('17199000-0000-4000-8000-000000000022','17199000-0000-4000-8000-000000000012',1,'reprogramar','2026-11-09 12:00+00','2026-11-09 13:00+00','Reprogramar')$$,'42501','visita_nao_encontrada_ou_sem_acesso','outro Cliente negado');
select throws_ok($$select pcm.sso_transicionar_visita_mediada('17199000-0000-4000-8000-000000000023','17199000-0000-4000-8000-000000000011',1,'reprogramar','2026-11-10 12:00+00','2026-11-10 13:00+00','Reprogramar')$$,'40001','revisao_obsoleta','revisão antiga recusada');
select throws_ok($$select pcm.sso_transicionar_visita_mediada('17199000-0000-4000-8000-000000000024','17199000-0000-4000-8000-000000000011',2,'cancelar',null,null,'Cancelar')$$,'42501','visita_nao_encontrada_ou_sem_acesso','cancelamento exige capacidade própria');
select throws_ok($$select pcm.sso_transicionar_visita_mediada('17199000-0000-4000-8000-000000000025','17199000-0000-4000-8000-000000000013',1,'reprogramar','2026-11-09 12:00+00','2026-11-09 13:00+00','Reprogramar')$$,'23514','efeito_remoto_exige_reconciliacao','OS enviada exige reconciliação');
reset role;
select is((select estado from pcm.visitas where id='17199000-0000-4000-8000-000000000011'),'planejada','confirmação anterior invalidada');
select is((select count(*)::integer from pcm.visita_transicoes_historico where visita_id='17199000-0000-4000-8000-000000000011'),1,'histórico não duplicado');
select is((select count(*)::integer from pcm.visita_transicoes_historico where visita_id='17199000-0000-4000-8000-000000000013'),0,'recusa não cria histórico');
select ok(not has_function_privilege('authenticated','pcm.sso_transicionar_visita_preparada(uuid,uuid,integer,text,timestamp with time zone,timestamp with time zone,text)','execute'),'núcleo continua privado');
select ok(not has_function_privilege('anon','pcm.sso_transicionar_visita_mediada(uuid,uuid,integer,text,timestamp with time zone,timestamp with time zone,text)','execute') and has_function_privilege('authenticated','pcm.sso_transicionar_visita_mediada(uuid,uuid,integer,text,timestamp with time zone,timestamp with time zone,text)','execute'),'somente authenticated chama mediadora');
update config.sso_concessoes set ativa=false where usuario_id='17199000-0000-4000-8000-000000000001' and acao='visita.confirmar';
set local role authenticated;
select throws_ok($$select pcm.sso_transicionar_visita_mediada('17199000-0000-4000-8000-000000000021','17199000-0000-4000-8000-000000000011',1,'reprogramar','2026-11-09 12:00+00','2026-11-09 13:00+00','Reprogramar')$$,'42501','visita_nao_encontrada_ou_sem_acesso','replay após revogação é negado');
reset role;
select * from finish();
rollback;
