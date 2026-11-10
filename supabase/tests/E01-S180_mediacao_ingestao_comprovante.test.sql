-- Apenas base descartável com migrations aplicadas; teste revertido.
\set ON_ERROR_STOP on
begin;
set local app.auvo_sync_write='true';
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(5);
select ok(not has_function_privilege('authenticated','pcm.sso_ingestao_comprovante_servico(text,uuid,uuid,uuid,text,uuid)','execute'),'usuário não pode invocar mediação de serviço');
select ok(not has_function_privilege('anon','pcm.sso_ingestao_comprovante_servico(text,uuid,uuid,uuid,text,uuid)','execute'),'anônimo não pode invocar mediação');
select ok(has_function_privilege('service_role','pcm.sso_ingestao_comprovante_servico(text,uuid,uuid,uuid,text,uuid)','execute'),'serviço pode invocar wrapper');
set local request.jwt.claims='{"role":"authenticated"}';
select throws_ok($$select pcm.sso_ingestao_comprovante_servico('reservar',null,null,null,null,null)$$,'42501',null,'JWT de usuário é recusado mesmo com execução privilegiada');
set local request.jwt.claims='{"role":"service_role"}';
set local role service_role;
select throws_ok($$select pcm.sso_ingestao_comprovante_servico('reservar',null,null,null,null,null)$$,'55000',null,'serviço não contorna gate fechado');
reset role;
select * from finish();
rollback;
