-- APENAS base descartável e isolada. Fixtures imutáveis permanecem após COMMIT.
begin;
set local app.auvo_sync_write = 'true';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('18290000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','concorrencia-182@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('18290000-0000-0000-0000-000000000001','superadmin','Concorrência S182',true);
insert into pcm.clientes(id,nome,ativo,created_by) values ('18290000-0000-0000-0000-00000000000a','Cliente sintético concorrência S182',true,'18290000-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('18290000-0000-0000-0000-000000000001','faturavel.efetivar','18290000-0000-0000-0000-00000000000a');
insert into financeiro.categorias(id,nome,tipo) values ('18290000-0000-0000-0000-000000000011','Categoria concorrência S182','entrada');
insert into financeiro.lancamentos(id,tipo,status,valor_centavos,data_competencia,data_pagamento,categoria_id,cliente_id,descricao) values
 ('18290000-0000-0000-0000-000000000021','entrada','realizado',10000,'2026-11-01','2026-11-01','18290000-0000-0000-0000-000000000011','18290000-0000-0000-0000-00000000000a','Sintético A'),
 ('18290000-0000-0000-0000-000000000022','entrada','realizado',10000,'2026-11-01','2026-11-01','18290000-0000-0000-0000-000000000011','18290000-0000-0000-0000-00000000000a','Sintético B');
insert into financeiro.itens_faturaveis(id,cliente_id,origem_tipo,origem_id,valor_original_centavos,valor_conferido_centavos,competencia,status,revisao) values
 ('18290000-0000-0000-0000-000000000031','18290000-0000-0000-0000-00000000000a','teste_sintetico','18290000-0000-0000-0000-000000000041',10000,10000,'2026-11-01','conferido',2),
 ('18290000-0000-0000-0000-000000000032','18290000-0000-0000-0000-00000000000a','teste_sintetico','18290000-0000-0000-0000-000000000042',10000,10000,'2026-11-01','conferido',2);
update financeiro.sso_faturamento_gate set habilitado=true where id;
update financeiro.sso_selecao_documento_gate set habilitado=true where id;
update financeiro.sso_documento_interno_gate set habilitado=true where id;
update financeiro.sso_reserva_documento_liberacao_gate set habilitado=true where id;
grant execute on function financeiro.sso_selecionar_faturavel_documento(uuid,uuid,integer), financeiro.sso_emitir_documento_interno_parcial(uuid,uuid,bigint), financeiro.sso_alocar_faturavel_documento(uuid,uuid,uuid,integer,uuid,text,date,bigint), financeiro.sso_converter_reserva_interna(uuid,uuid,integer,uuid,uuid,text,date,text) to authenticated;
set local request.jwt.claims = '{"sub":"18290000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
select financeiro.sso_selecionar_faturavel_documento('18290000-0000-0000-0000-000000000051','18290000-0000-0000-0000-000000000031',2);
select financeiro.sso_selecionar_faturavel_documento('18290000-0000-0000-0000-000000000052','18290000-0000-0000-0000-000000000032',2);
commit;
