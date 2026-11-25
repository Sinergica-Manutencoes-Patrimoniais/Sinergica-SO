-- Scripts operacionais: criação, replay e aposentadoria sem efeitos remotos.
begin;
select plan(8);
select set_config('app.auvo_sync_write','true',true);
insert into auth.users(id,email) values('02819000-0000-4000-8000-000000000001','sinergicaengenharia+gestorpcm@gmail.com');
insert into config.usuarios(user_id,papel,nome,ativo) values('02819000-0000-4000-8000-000000000001','superadmin','Gestor teste',true);
insert into pcm.clientes(id,nome,ativo,created_by) values('741a283b-8e23-449f-83c7-668f35c98f20','Sinérgica - Escritório',true,'02819000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('02819000-0000-4000-8000-000000000001','execucao.validar','741a283b-8e23-449f-83c7-668f35c98f20'),
 ('02819000-0000-4000-8000-000000000001','visita.confirmar','741a283b-8e23-449f-83c7-668f35c98f20');
update pcm.sso_consulta_estado_campo_gate set habilitado=true where id;
update pcm.capacidade_agenda_tecnico_gate set habilitado=true where id;
select set_config('app.auvo_sync_write','false',true);
\ir fixtures/homologacao-escritorio-preparar.sql
\ir fixtures/homologacao-escritorio-preparar.sql
select is((select count(*)::int from pcm.ordens_servico where id in ('02819000-0000-4000-8000-000000000030','02819000-0000-4000-8000-000000000031')),2,'replay não duplica OS');
select is((select count(*)::int from pcm.auvo_sync_outbox where row_id::text like '02819000%'),0,'nenhuma fila Auvo');
select is((select count(*)::int from pcm.sso_t24_tentativas where os_id::text like '02819000%'),0,'nenhuma tentativa T24');
set local role authenticated;
set local request.jwt.claims='{"sub":"02819000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
select is((select count(*)::int from pcm.sso_listar_campo_a_conciliar('02819000-0000-4000-8000-000000000001','741a283b-8e23-449f-83c7-668f35c98f20',50)),1,'roteiro 1 tem OS a conciliar');
select is((select count(*)::int from pcm.sso_listar_excecoes_auvo_t24('02819000-0000-4000-8000-000000000001','741a283b-8e23-449f-83c7-668f35c98f20',50) where tipo='visita_nao_confirmada'),1,'roteiro T24 mostra exceção sem envio');
select is((select count(*)::int from pcm.sso_listar_agenda_tecnico_projetada('741a283b-8e23-449f-83c7-668f35c98f20',date_trunc('week',(now()+interval '2 hours') at time zone 'America/Sao_Paulo')::date,500)),1,'agenda mostra Visita planejada');
reset role;
select set_config('app.auvo_sync_write','false',true);
\ir fixtures/homologacao-escritorio-aposentar.sql
select is((select count(*)::int from pcm.ordens_servico where id in ('02819000-0000-4000-8000-000000000030','02819000-0000-4000-8000-000000000031') and deleted_at is null),0,'aposentadoria retira exemplos da operação');
select is((select count(*)::int from pcm.auvo_sync_outbox where row_id::text like '02819000%'),0,'aposentadoria também não gera fila');
select * from finish();
rollback;

