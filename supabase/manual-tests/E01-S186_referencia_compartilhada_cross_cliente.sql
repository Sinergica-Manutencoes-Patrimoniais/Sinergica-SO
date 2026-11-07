-- Apenas banco isolado. Fixtures revertidas; não altera gate nem envia Auvo.
-- Executa cópia temporária do corpo instalado, com a condição do gate removida
-- APENAS da cópia, para testar lógica sem ativar a função operacional.
begin;
set local app.auvo_sync_write = 'true';
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(7);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('18691900-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s186-referencia@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('18691900-0000-4000-8000-000000000001','superadmin','Gestor sintético',true);
insert into pcm.clientes(id,nome,created_by) values
 ('18691900-0000-4000-8000-00000000000a','Cliente A sintético','18691900-0000-4000-8000-000000000001'),
 ('18691900-0000-4000-8000-00000000000b','Cliente B sintético','18691900-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('18691900-0000-4000-8000-000000000001','plano.gerir','18691900-0000-4000-8000-00000000000a');
insert into pcm.chamados(id,numero,cliente_id,titulo,created_by) values
 ('18691900-0000-4000-8000-000000000011','CH-S186-CROSS-A','18691900-0000-4000-8000-00000000000a','Chamado A','18691900-0000-4000-8000-000000000001'),
 ('18691900-0000-4000-8000-000000000012','CH-S186-CROSS-B','18691900-0000-4000-8000-00000000000b','Chamado B','18691900-0000-4000-8000-000000000001'),
 ('18691900-0000-4000-8000-000000000013','CH-S186-CROSS-C','18691900-0000-4000-8000-00000000000a','Chamado C','18691900-0000-4000-8000-000000000001');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,created_by,chamado_id) values
 ('18691900-0000-4000-8000-000000000021','18691900-0000-4000-8000-00000000000a','ignorado','OS A','corretiva','18691900-0000-4000-8000-000000000001','18691900-0000-4000-8000-000000000011'),
 ('18691900-0000-4000-8000-000000000023','18691900-0000-4000-8000-00000000000a','ignorado','OS C','corretiva','18691900-0000-4000-8000-000000000001','18691900-0000-4000-8000-000000000013');
update pcm.chamados set ordem_servico_id='18691900-0000-4000-8000-000000000021' where id in ('18691900-0000-4000-8000-000000000011','18691900-0000-4000-8000-000000000012');
update pcm.chamados set ordem_servico_id='18691900-0000-4000-8000-000000000023' where id='18691900-0000-4000-8000-000000000013';
select set_config('request.jwt.claims','{"sub":"18691900-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);
do $test$
declare v_def text; v_clonada text;
begin
  select pg_get_functiondef('pcm.sso_prever_referencias_chamado_os(uuid,uuid,integer)'::regprocedure) into v_def;
  v_clonada := replace(v_def,'FUNCTION pcm.sso_prever_referencias_chamado_os(', 'FUNCTION pg_temp.sso_prever_referencias_chamado_os(');
  v_clonada := replace(v_clonada,'if not coalesce((select habilitado from pcm.migracao_preflight_gate where id),false) then', 'if false then');
  if v_clonada = v_def or position('if false then' in v_clonada)=0 then raise exception 'cópia de teste não pôde ser construída'; end if;
  execute v_clonada;
end $test$;
select is((select classificacao from pg_temp.sso_prever_referencias_chamado_os('18691900-0000-4000-8000-00000000000a',null,100) where chamado_id='18691900-0000-4000-8000-000000000011'), 'referencia_compartilhada_revisar', 'referência compartilhada entre Clientes não é coerente');
select is((select classificacao from pg_temp.sso_prever_referencias_chamado_os('18691900-0000-4000-8000-00000000000a',null,100) where chamado_id='18691900-0000-4000-8000-000000000013'), 'referencia_coerente', 'vínculo não compartilhado permanece coerente');
select is((select count(*)::int from pg_temp.sso_prever_referencias_chamado_os('18691900-0000-4000-8000-00000000000a',null,100) where chamado_id='18691900-0000-4000-8000-000000000012'), 0, 'não lista Chamado de outro Cliente');
select is((select count(*)::int from pcm.auvo_sync_outbox where row_id in ('18691900-0000-4000-8000-000000000021','18691900-0000-4000-8000-000000000023')), 0, 'fixtures não criam outbox Auvo');
select is((select habilitado from pcm.migracao_preflight_gate where id), false, 'gate operacional permaneceu fechado');
select throws_ok($$select * from pcm.sso_prever_referencias_chamado_os('18691900-0000-4000-8000-00000000000a',null,100)$$, '55000', 'diagnostico_bloqueado', 'função operacional continua bloqueada');
select set_config('request.jwt.claims','{"sub":"18691900-0000-4000-8000-000000000099","role":"authenticated"}',true);
select throws_ok($$select * from pg_temp.sso_prever_referencias_chamado_os('18691900-0000-4000-8000-00000000000a',null,100)$$, '42501', 'cliente_nao_encontrado_ou_sem_acesso', 'cópia rejeita usuário sem acesso');
select * from finish();
rollback;
