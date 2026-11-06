-- Banco isolado; fixtures e gate revertidos, sem chamada externa.
begin;
set local app.auvo_sync_write='true';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('16791000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s167-resumo@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16791000-0000-4000-8000-000000000001','superadmin','Gestor sintético',true);
insert into pcm.clientes(id,nome,created_by) values
 ('16791000-0000-4000-8000-00000000000a','Cliente A','16791000-0000-4000-8000-000000000001'),
 ('16791000-0000-4000-8000-00000000000b','Cliente B','16791000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16791000-0000-4000-8000-000000000001','chamado.encerrar','16791000-0000-4000-8000-00000000000a');
insert into pcm.chamados(id,numero,cliente_id,titulo,created_by) values
 ('16791000-0000-4000-8000-000000000011','CH-S167-A','16791000-0000-4000-8000-00000000000a','Chamado A','16791000-0000-4000-8000-000000000001'),
 ('16791000-0000-4000-8000-000000000012','CH-S167-B','16791000-0000-4000-8000-00000000000b','Chamado B','16791000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,created_by,chamado_id,status) values
 ('16791000-0000-4000-8000-000000000021','16791000-0000-4000-8000-00000000000a','OS-S167-A1','OS A1','corretiva','16791000-0000-4000-8000-000000000001','16791000-0000-4000-8000-000000000011','finalizado'),
 ('16791000-0000-4000-8000-000000000022','16791000-0000-4000-8000-00000000000a','OS-S167-A2','OS A2','corretiva','16791000-0000-4000-8000-000000000001',null,'em_execucao');
update pcm.chamados set ordem_servico_id='16791000-0000-4000-8000-000000000022' where id='16791000-0000-4000-8000-000000000011';
select set_config('request.jwt.claims','{"sub":"16791000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);
set local role authenticated;
do $$ begin
 begin
  perform * from pcm.sso_resumir_chamados_lote(array['16791000-0000-4000-8000-000000000011'::uuid]);
  raise exception 'gate_nao_fechado';
 exception when object_not_in_prerequisite_state then
  if sqlerrm <> 'resumo_chamado_bloqueado' then raise; end if;
 end;
end $$;
reset role;
update pcm.sso_resumo_chamado_lote_gate set habilitado=true where id;
set local role authenticated;
do $$ declare r record; begin
 select * into r from pcm.sso_resumir_chamados_lote(array['16791000-0000-4000-8000-000000000011'::uuid,'16791000-0000-4000-8000-000000000012'::uuid]);
 if r.total <> 2 or r.finalizadas <> 1 or r.etapas_mistas is not true then raise exception 'resumo_incorreto'; end if;
 if (select count(*) from pcm.sso_resumir_chamados_lote(array['16791000-0000-4000-8000-000000000012'::uuid])) <> 0 then raise exception 'cliente_sem_permissao_exposto'; end if;
end $$;
reset role;
set local session_replication_role=replica;
update pcm.ordens_servico set client_id='16791000-0000-4000-8000-00000000000b' where id='16791000-0000-4000-8000-000000000021';
set local session_replication_role=origin;
set local role authenticated;
do $$ begin
 if (select count(*) from pcm.sso_resumir_chamados_lote(array['16791000-0000-4000-8000-000000000011'::uuid])) <> 0 then raise exception 'vinculo_divergente_exposto'; end if;
end $$;
rollback;
