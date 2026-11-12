-- Exclusivamente em banco descartável identificado; não executa Auvo nem altera produção.
do $$ begin
  if current_database() <> 'sso_s167_criacoes' or current_setting('cron.launch_active_jobs',true) is distinct from 'off' then
    raise exception 'banco_descartavel_ou_cron_invalido';
  end if;
end $$;
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
set local app.auvo_sync_write = 'true';
select plan(9);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('16750000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s167-criacoes@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16750000-0000-4000-8000-000000000001','superadmin','S167 criações',true);
insert into pcm.clientes(id,nome,ativo,created_by) values ('16750000-0000-4000-8000-00000000000a','Cliente S167',true,'16750000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16750000-0000-4000-8000-000000000001','chamado.os.criar','16750000-0000-4000-8000-00000000000a');
insert into pcm.chamados(id,numero,cliente_id,titulo,origem,status,created_by) values ('16750000-0000-4000-8000-000000000011','CH-S167-CRIA','16750000-0000-4000-8000-00000000000a','Chamado','manual','aberto','16750000-0000-4000-8000-000000000001');
update pcm.sso_criacao_os_mediada_gate set habilitado=true where id;
update pcm.chamado_os_gate set habilitado=true where id;
-- O corte 1:1 -> 1:N deixou de ser simulado aqui: a migration 1842 removeu o índice legado
-- `pcm.uq_ordens_servico_chamado` e a trigger `trg_ordens_servico_numero_chamado` do schema,
-- e abriu `pcm.sso_guarda_multiplas_os_gate`. O banco descartável já nasce no estado final.
create temporary table s167_outbox_antes as select count(*) n from pcm.auvo_sync_outbox;
set local request.jwt.claims = '{"sub":"16750000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select is(pcm.sso_criar_os_chamado_autorizado('16750000-0000-4000-8000-000000000101',1,'16750000-0000-4000-8000-000000000011','16750000-0000-4000-8000-00000000000a','16750000-0000-4000-8000-000000000021','Primeira',null,'corretiva')->>'osId','16750000-0000-4000-8000-000000000021','primeiro pedido');
select is(pcm.sso_criar_os_chamado_autorizado('16750000-0000-4000-8000-000000000102',1,'16750000-0000-4000-8000-000000000011','16750000-0000-4000-8000-00000000000a','16750000-0000-4000-8000-000000000022','Segunda',null,'corretiva')->>'osId','16750000-0000-4000-8000-000000000022','segunda criação na revisão inicial');
select is(pcm.sso_criar_os_chamado_autorizado('16750000-0000-4000-8000-000000000103',1,'16750000-0000-4000-8000-000000000011','16750000-0000-4000-8000-00000000000a','16750000-0000-4000-8000-000000000023','Terceira',null,'corretiva')->>'osId','16750000-0000-4000-8000-000000000023','terceira criação na revisão inicial');
select is(pcm.sso_criar_os_chamado_autorizado('16750000-0000-4000-8000-000000000102',1,'16750000-0000-4000-8000-000000000011','16750000-0000-4000-8000-00000000000a','16750000-0000-4000-8000-000000000022','Segunda',null,'corretiva')->>'osId','16750000-0000-4000-8000-000000000022','replay devolve a mesma OS');
select throws_ok($$select pcm.sso_criar_os_chamado_autorizado('16750000-0000-4000-8000-000000000102',1,'16750000-0000-4000-8000-000000000011','16750000-0000-4000-8000-00000000000a','16750000-0000-4000-8000-000000000022','Mudança',null,'corretiva')$$,'23505','request_id_conflitante','payload divergente não é replay');
reset role;
update pcm.ordens_servico set titulo='OS alterada' where id='16750000-0000-4000-8000-000000000021';
set local role authenticated;
select throws_ok($$select pcm.sso_criar_os_chamado_autorizado('16750000-0000-4000-8000-000000000104',1,'16750000-0000-4000-8000-000000000011','16750000-0000-4000-8000-00000000000a','16750000-0000-4000-8000-000000000024','Quarta',null,'corretiva')$$,'40001','revisao_obsoleta','OS intermediária alterada impede reconciliação');
reset role;
select is((select count(*)::int from pcm.ordens_servico where chamado_id='16750000-0000-4000-8000-000000000011'),3,'três OS e nenhuma duplicação');
select is((select ordem_servico_id::text from pcm.chamados where id='16750000-0000-4000-8000-000000000011'),'16750000-0000-4000-8000-000000000021','referência original preservada');
select is((select count(*) from pcm.auvo_sync_outbox),(select n from s167_outbox_antes),'nenhum outbox Auvo');
select * from finish();
rollback;
