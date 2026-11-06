-- Preparação parcial do E2E S165. Somente em clone descartável já atestado pelo chamador.
-- O chamador aplica em transação única; s165_senha é fornecida via stdin do psql.
-- Não prepara revisão, aprovação, impactos ou questionário histórico.
set local app.auvo_sync_write = 'true';
do $$ begin
 if current_setting('app.sso_ensaio_descartavel', true) is distinct from 's165' then
  raise exception 'fixture_exige_clone_descartavel' using errcode='55000';
 end if;
end $$;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
 raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('16591000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','s165-e2e-sintetico@example.test',crypt(:'s165_senha',gen_salt('bf')),
 now(),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo)
values('16591000-0000-4000-8000-000000000001','colaborador','Operador sintético S165',true);
insert into config.usuario_modulos(user_id,modulo,nivel)
values('16591000-0000-4000-8000-000000000001','pcm','escrita');
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('16591000-0000-4000-8000-00000000000a','Cliente sintético S165 A',true,'16591000-0000-4000-8000-000000000001'),
 ('16591000-0000-4000-8000-00000000000b','Cliente sintético S165 B',true,'16591000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('16591000-0000-4000-8000-000000000001','plano.gerir','16591000-0000-4000-8000-00000000000a'),
 ('16591000-0000-4000-8000-000000000001','plano.gerir','16591000-0000-4000-8000-00000000000b');
