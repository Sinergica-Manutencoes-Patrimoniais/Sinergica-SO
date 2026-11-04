-- Somente clone descartável isolado; nenhum dado ou chamada externa real.
begin;
set local app.auvo_sync_write='true';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('16660000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','acesso-s166@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16660000-0000-0000-0000-000000000001','superadmin','Acesso sintético',true);
insert into pcm.clientes(id,nome,ativo,created_by) values ('16660000-0000-0000-0000-00000000000a','Cliente sintético',true,'16660000-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16660000-0000-0000-0000-000000000001','plano.gerir','16660000-0000-0000-0000-00000000000a'),('16660000-0000-0000-0000-000000000001','visita.confirmar','16660000-0000-0000-0000-00000000000a');
insert into comercial.etapas_funil(id,nome,ordem,cor) values ('16660000-0000-0000-0000-000000000030','Etapa sintética',1,'#000');
insert into comercial.oportunidades(id,cliente_id,etapa_id,titulo) values ('16660000-0000-0000-0000-000000000031','16660000-0000-0000-0000-00000000000a','16660000-0000-0000-0000-000000000030','Oportunidade sintética');
insert into comercial.propostas(id,oportunidade_id,tipo) values ('16660000-0000-0000-0000-000000000032','16660000-0000-0000-0000-000000000031','volante');
insert into comercial.contratos(id,proposta_id,cliente_id,tipo,vigencia_inicio) values ('16660000-0000-0000-0000-000000000033','16660000-0000-0000-0000-000000000032','16660000-0000-0000-0000-00000000000a','volante','2026-01-01');
insert into pcm.calendario_contratual_series(id,cliente_id,contrato_id,created_by) values ('16660000-0000-0000-0000-000000000020','16660000-0000-0000-0000-00000000000a','16660000-0000-0000-0000-000000000033','16660000-0000-0000-0000-000000000001');
insert into pcm.regras_visita_contratual(id,serie_id,numero,ancora_semana,dia_semana,intervalo_semanas,hora_inicio,duracao_minutos,fuso,vigencia_inicio,created_by) values ('16660000-0000-0000-0000-000000000021','16660000-0000-0000-0000-000000000020',1,'2026-10-05',5,1,'08:00',120,'UTC','2026-01-01','16660000-0000-0000-0000-000000000001');
update pcm.sso_acesso_geracao_visita_gate set habilitado=true where id;
update pcm.sso_gerar_visita_contratual_gate set habilitado=true where id;
update pcm.feriado_declarado_gate set habilitado=true where id;
update pcm.sso_origem_contratual_unica_gate set habilitado=true where id;
commit;
