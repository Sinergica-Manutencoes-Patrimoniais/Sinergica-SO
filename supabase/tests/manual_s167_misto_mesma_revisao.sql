-- Somente banco descartável identificado; fixtures e concessões são revertidas.
do $$ begin
  if current_database() <> 'sso_s167_criacoes' or current_setting('cron.launch_active_jobs',true) is distinct from 'off' then
    raise exception 'banco_descartavel_ou_cron_invalido';
  end if;
end $$;
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
set local app.auvo_sync_write = 'true';
select plan(7);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('16760000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s167-misto@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16760000-0000-4000-8000-000000000001','superadmin','S167 misto',true);
insert into pcm.clientes(id,nome,ativo,created_by) values ('16760000-0000-4000-8000-00000000000a','Cliente S167',true,'16760000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16760000-0000-4000-8000-000000000001','chamado.os.criar','16760000-0000-4000-8000-00000000000a');
insert into pcm.chamados(id,numero,cliente_id,titulo,origem,status,created_by) values ('16760000-0000-4000-8000-000000000011','CH-S167-MISTO','16760000-0000-4000-8000-00000000000a','Chamado','manual','aberto','16760000-0000-4000-8000-000000000001');
update pcm.sso_criacao_os_mediada_gate set habilitado=true where id;
update pcm.chamado_os_gate set habilitado=true where id;
update pcm.sso_conversao_integral_mediada_gate set habilitado=true where id;
update pcm.sso_conversao_escopo_gate set habilitado=true where id;
update pcm.sso_os_concorrente_gate set habilitado=true where id;
drop index pcm.uq_ordens_servico_chamado;
drop trigger trg_ordens_servico_numero_chamado on pcm.ordens_servico;
grant execute on function pcm.sso_converter_os_concorrente(uuid,bigint,uuid,uuid,uuid,jsonb,text,text,text,uuid) to authenticated;
create temporary table s167_misto_dados as select
 pcm.sso_hash_escopo_chamado('16760000-0000-4000-8000-000000000011') as hash,
 jsonb_build_object('titulo','Chamado','descricao',null,'categoria','corretiva','prioridade','normal',
 'gravidade',3,'urgencia',3,'tendencia',3,'dor_cliente',null,'observacao',null,'local_descricao',null,
 'solicitante',null,'origem','manual','tipo_tarefa_id',null,'tecnico_funcionario_id',null,'data_agendada',null,
 'tipo_os','C2','pmoc_schedule_id',null,'origem_inspecao_item_id',null,'equipamento_id',null,'foto_urls','[]'::jsonb) as campos;
grant select on s167_misto_dados to authenticated;
create temporary table s167_misto_outbox as select count(*) n from pcm.auvo_sync_outbox;
set local request.jwt.claims = '{"sub":"16760000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select is(pcm.sso_criar_os_chamado_autorizado('16760000-0000-4000-8000-000000000101',1,'16760000-0000-4000-8000-000000000011','16760000-0000-4000-8000-00000000000a','16760000-0000-4000-8000-000000000021','Primeira',null,'corretiva')->>'osId','16760000-0000-4000-8000-000000000021','criação simples');
select is(pcm.sso_converter_os_concorrente('16760000-0000-4000-8000-000000000102',1,'16760000-0000-4000-8000-000000000011','16760000-0000-4000-8000-00000000000a','16760000-0000-4000-8000-000000000022',(select campos from s167_misto_dados),'convertido_os',null,(select hash from s167_misto_dados),'16760000-0000-4000-8000-000000000001')->>'osId','16760000-0000-4000-8000-000000000022','conversão integral aceita criação simples comprovada');
select is(pcm.sso_criar_os_chamado_autorizado('16760000-0000-4000-8000-000000000103',1,'16760000-0000-4000-8000-000000000011','16760000-0000-4000-8000-00000000000a','16760000-0000-4000-8000-000000000023','Terceira',null,'corretiva')->>'osId','16760000-0000-4000-8000-000000000023','criação simples aceita sequência mista comprovada');
select is(pcm.sso_converter_os_concorrente('16760000-0000-4000-8000-000000000102',1,'16760000-0000-4000-8000-000000000011','16760000-0000-4000-8000-00000000000a','16760000-0000-4000-8000-000000000022',(select campos from s167_misto_dados),'convertido_os',null,(select hash from s167_misto_dados),'16760000-0000-4000-8000-000000000001')->>'osId','16760000-0000-4000-8000-000000000022','replay integral não duplica');
reset role;
select is((select count(*)::int from pcm.ordens_servico where chamado_id='16760000-0000-4000-8000-000000000011'),3,'três OS vinculadas');
select is((select ordem_servico_id::text from pcm.chamados where id='16760000-0000-4000-8000-000000000011'),'16760000-0000-4000-8000-000000000021','vínculo legado preservado');
select is((select count(*) from pcm.auvo_sync_outbox),(select n from s167_misto_outbox),'nenhuma intenção Auvo');
select * from finish();
rollback;
