begin;
\ir E01-S172_snapshot_capacidade_fixture.sql
select plan(8);
select ok(has_function_privilege('authenticated','pcm.sso_mediar_declaracao_esforco(uuid,uuid,text,uuid,integer,integer,integer,integer,text)','execute'),'authenticated usa mediador');
select ok(not has_function_privilege('authenticated','pcm.sso_declarar_esforco_capacidade(uuid,uuid,text,uuid,integer,integer,integer,integer,text)','execute'),'comando interno continua privado');
select throws_ok($$select pcm.sso_consultar_esforco_autorizado(null,null,null)$$,'55000','esforco_capacidade_bloqueado','leitura respeita gate');
update pcm.capacidade_esforco_declarado_gate set habilitado=true where id;
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16896000-0000-4000-8000-000000000001','capacidade.gerir','16896000-0000-4000-8000-000000000002');
set local request.jwt.claims = '{"sub":"16896000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select is(pcm.sso_consultar_esforco_autorizado('16896000-0000-4000-8000-000000000002','os','16896000-0000-4000-8000-000000000017')->>'revision','0','origem sem declaração permanece pendente');
select throws_ok($$select pcm.sso_consultar_esforco_autorizado('16896000-0000-4000-8000-000000000002','os','16895000-0000-4000-8000-000000000017')$$,'42501','sem_acesso','origem de outro Cliente negada');
select is(pcm.sso_mediar_declaracao_esforco('17296000-0000-4000-8000-000000000011','16896000-0000-4000-8000-000000000002','os','16896000-0000-4000-8000-000000000017',0,null,120,30,'confirmado')->>'revision','1','escrita mediada autorizada');
select is(pcm.sso_consultar_esforco_autorizado('16896000-0000-4000-8000-000000000002','os','16896000-0000-4000-8000-000000000017')->>'terceirosMinutos','120','leitura preserva valor de terceiro');
select is(pcm.sso_consultar_esforco_autorizado('16896000-0000-4000-8000-000000000002','os','16896000-0000-4000-8000-000000000017')->>'internosMinutos',null::text,'leitura não inventa minutos internos');
reset role;
select * from finish();
rollback;
