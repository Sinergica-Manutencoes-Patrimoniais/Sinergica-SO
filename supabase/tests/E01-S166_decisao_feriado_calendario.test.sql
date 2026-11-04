-- Somente banco sintético isolado, em transação revertida.
begin;
set local app.auvo_sync_write='true';
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
\ir E01-S168_finalizacao_fixture_real.sql
select plan(9);
set local request.jwt.claims='{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok($q$select pcm.sso_decidir_feriado_calendario('16891000-0000-4000-8000-000000000090','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000015','16891000-0000-4000-8000-000000000091',0,'PCM conferiu')$q$,'55000',null,'gates fechados impedem decisão');
reset role;
update pcm.sso_decisao_feriado_calendario_gate set habilitado=true where id;
update pcm.feriado_declarado_gate set habilitado=true where id;
insert into pcm.feriados_declarados(id,cliente_id,data,fonte,motivo,criado_por) values ('16891000-0000-4000-8000-000000000091','16891000-0000-4000-8000-000000000002','2026-01-01','Fonte sintética','Feriado','16891000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok($q$select pcm.sso_decidir_feriado_calendario('16891000-0000-4000-8000-000000000090','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000015','16891000-0000-4000-8000-000000000091',0,'PCM conferiu')$q$,'42501',null,'capacidade é obrigatória');
reset role;
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16891000-0000-4000-8000-000000000001','plano.gerir','16891000-0000-4000-8000-000000000002');
set local role authenticated;
select is((pcm.sso_listar_feriados_ciclo('16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000007','16891000-0000-4000-8000-000000000008','16891000-0000-4000-8000-000000000009',0)->>'preparadaExiste')::boolean,true,'ciclo existente é apresentado');
select is((pcm.sso_decidir_feriado_calendario('16891000-0000-4000-8000-000000000090','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000015','16891000-0000-4000-8000-000000000091',0,'PCM conferiu')->>'decisao'),'manter_para_pcm','feriado mantém obrigação para PCM');
select is((pcm.sso_decidir_feriado_calendario('16891000-0000-4000-8000-000000000090','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000015','16891000-0000-4000-8000-000000000091',0,'PCM conferiu')->>'revisao')::integer,1,'replay conserva revisão');
select throws_ok($q$select pcm.sso_decidir_feriado_calendario('16891000-0000-4000-8000-000000000090','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000015','16891000-0000-4000-8000-000000000091',0,'Motivo alterado')$q$,'23505',null,'requestId divergente é negado');
select throws_ok($q$select pcm.sso_decidir_feriado_calendario('16891000-0000-4000-8000-000000000092','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000015','16891000-0000-4000-8000-000000000091',0,'PCM conferiu')$q$,'40001',null,'revisão obsoleta é negada');
reset role;
select is((select vencimento_original::text from pcm.ocorrencias_rotina_preparadas where id='16891000-0000-4000-8000-000000000015'),'2026-01-01','data original permanece intacta');
select is((select count(*)::integer from pcm.sso_decisoes_feriado_calendario where preparada_id='16891000-0000-4000-8000-000000000015'),1,'replay não duplica decisão');
select * from finish();
rollback;
