-- Sessão B deve iniciar enquanto A dorme; insere pelo caminho legado, sem Auvo.
begin;
set local app.auvo_sync_write='true';
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,status,created_by,chamado_id) values ('16796000-0000-4000-8000-000000000023','16796000-0000-4000-8000-00000000000a','ignorado','Nova OS tardia','corretiva','em_execucao','16796000-0000-4000-8000-000000000001','16796000-0000-4000-8000-000000000011');
commit;
