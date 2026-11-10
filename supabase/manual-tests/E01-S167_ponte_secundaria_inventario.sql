-- Caracterização de hipótese; ponte TEMPORÁRIA apenas neste teste, nunca gravada como contrato.
-- Aplique 1010 somente na mesma transação antes deste arquivo.
begin;
set local app.auvo_sync_write='true';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('16796000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s167-ponte@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16796000-0000-4000-8000-000000000001','superadmin','Gestor sintético',true);
insert into pcm.clientes(id,nome,created_by) values ('16796000-0000-4000-8000-00000000000a','Cliente sintético','16796000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16796000-0000-4000-8000-000000000001','chamado.encerrar','16796000-0000-4000-8000-00000000000a');
insert into pcm.chamados(id,numero,cliente_id,titulo,created_by) values ('16796000-0000-4000-8000-000000000011','CH-S167-PONTE','16796000-0000-4000-8000-00000000000a','Chamado sintético','16796000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,created_by,chamado_id,status) values
 ('16796000-0000-4000-8000-000000000021','16796000-0000-4000-8000-00000000000a','IGNORADO','OS direta','corretiva','16796000-0000-4000-8000-000000000001','16796000-0000-4000-8000-000000000011','finalizado'),
 ('16796000-0000-4000-8000-000000000022','16796000-0000-4000-8000-00000000000a','CH-S167-PONTE-OS-2','OS secundária','corretiva','16796000-0000-4000-8000-000000000001',null,'em_execucao');
update pcm.chamados set ordem_servico_id='16796000-0000-4000-8000-000000000021' where id='16796000-0000-4000-8000-000000000011';
create temporary table ponte_hipotetica(chamado_id uuid, os_id uuid) on commit drop;
insert into ponte_hipotetica values ('16796000-0000-4000-8000-000000000011','16796000-0000-4000-8000-000000000022');
select set_config('request.jwt.claims','{"sub":"16796000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);
update pcm.chamado_os_gate set habilitado=true where id;
update pcm.sso_resumo_chamado_lote_gate set habilitado=true where id;
do $$ begin
 if (select count(*) from pcm.sso_listar_ordens_chamado('16796000-0000-4000-8000-00000000000a','16796000-0000-4000-8000-000000000011',20,null)) <> 1 then raise exception 'fixture_inesperada'; end if;
 if exists(select 1 from pcm.sso_listar_ordens_chamado('16796000-0000-4000-8000-00000000000a','16796000-0000-4000-8000-000000000011',20,null) where id='16796000-0000-4000-8000-000000000022') then raise exception 'os_secundaria_nao_deveria_ser_visivel'; end if;
 if (select count(*) from pcm.ordens_servico where chamado_id='16796000-0000-4000-8000-000000000011' and status<>'finalizado')<>0 then raise exception 'fixture_status_inesperada'; end if;
 if (select chamado_id from pcm.operacao_itens where ordem_servico_id='16796000-0000-4000-8000-000000000022') is not null then raise exception 'view_nao_reproduziu'; end if;
 if (pcm.sso_avaliar_encerramento_chamado('16796000-0000-4000-8000-00000000000a','16796000-0000-4000-8000-000000000011')->>'ordensNaoFinalizadas')::int <> 0 then raise exception 'diagnostico_nao_reproduziu'; end if;
 if (select total from pcm.sso_resumir_chamados_lote(array['16796000-0000-4000-8000-000000000011'::uuid])) <> 1 then raise exception 'resumo_nao_reproduziu'; end if;
end $$;
rollback;
