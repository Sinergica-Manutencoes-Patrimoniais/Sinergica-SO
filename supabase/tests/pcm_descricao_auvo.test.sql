-- pcm_descricao_auvo.test.sql — pgTAP (E01-S158 AC-1..AC-3)
begin;
select plan(14);

select has_column('pcm', 'equipamentos', 'auvo_descricao', 'AC-2: Componente tem auvo_descricao');
select has_column('pcm', 'sistemas', 'auvo_descricao', 'AC-2: Sistema tem auvo_descricao');

set local role service_role;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000358', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'descricao-s158@test.local', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into pcm.clientes (id, nome, created_by, updated_by)
values ('00000000-0000-0000-0000-000000000359', '[TESTE] Cliente S158', '00000000-0000-0000-0000-000000000358', '00000000-0000-0000-0000-000000000358');
insert into pcm.areas (id, cliente_id, nome, created_by, updated_by)
values ('00000000-0000-0000-0000-000000000360', '00000000-0000-0000-0000-000000000359', '[TESTE] Área S158', '00000000-0000-0000-0000-000000000358', '00000000-0000-0000-0000-000000000358');
insert into pcm.locais (id, area_id, nome, created_by, updated_by)
values
  ('00000000-0000-0000-0000-000000000361', '00000000-0000-0000-0000-000000000360', '[TESTE] Local raiz S158', '00000000-0000-0000-0000-000000000358', '00000000-0000-0000-0000-000000000358'),
  ('00000000-0000-0000-0000-000000000362', '00000000-0000-0000-0000-000000000360', 'Shaft S158', '00000000-0000-0000-0000-000000000358', '00000000-0000-0000-0000-000000000358');
update pcm.locais set parent_id = '00000000-0000-0000-0000-000000000361' where id = '00000000-0000-0000-0000-000000000362';
insert into pcm.equipamento_categorias (id, nome, created_by, updated_by)
values ('00000000-0000-0000-0000-000000000363', '[TESTE] Categoria S158', '00000000-0000-0000-0000-000000000358', '00000000-0000-0000-0000-000000000358');

select is(
  pcm.fn_montar_descricao_auvo('00000000-0000-0000-0000-000000000359', '00000000-0000-0000-0000-000000000360', '00000000-0000-0000-0000-000000000362', '00000000-0000-0000-0000-000000000363', 'Bomba S158'),
  '[TESTE] Cliente S158 - [TESTE] Área S158 - [TESTE] Local raiz S158 - Shaft S158 - [TESTE] Categoria S158 - Bomba S158',
  'AC-1: concatena Cliente, Área, cadeia de Local, Categoria e nome'
);
select is(pcm.fn_montar_descricao_auvo(null, null, null, null, 'Bomba'), 'Bomba', 'AC-1: sem referências devolve só nome');
select is(pcm.fn_montar_descricao_auvo('00000000-0000-0000-0000-000000000359', null, null, '00000000-0000-0000-0000-000000000363', 'Alarmes'), '[TESTE] Cliente S158 - [TESTE] Categoria S158 - Alarmes', 'AC-1: omite níveis ausentes');

insert into pcm.equipamentos (id, nome, client_id, local_id, categoria_id, created_by, updated_by)
values ('00000000-0000-0000-0000-000000000364', 'Bomba S158', '00000000-0000-0000-0000-000000000359', '00000000-0000-0000-0000-000000000362', '00000000-0000-0000-0000-000000000363', '00000000-0000-0000-0000-000000000358', '00000000-0000-0000-0000-000000000358');
insert into pcm.sistemas (id, cliente_id, local_id, categoria_id, nome, created_by, updated_by)
values ('00000000-0000-0000-0000-000000000365', '00000000-0000-0000-0000-000000000359', '00000000-0000-0000-0000-000000000362', '00000000-0000-0000-0000-000000000363', 'Sistema S158', '00000000-0000-0000-0000-000000000358', '00000000-0000-0000-0000-000000000358');
select is((select auvo_descricao from pcm.equipamentos where id = '00000000-0000-0000-0000-000000000364'), '[TESTE] Cliente S158 - [TESTE] Área S158 - [TESTE] Local raiz S158 - Shaft S158 - [TESTE] Categoria S158 - Bomba S158', 'AC-2: insert calcula descrição');
update pcm.equipamentos set nome = 'Bomba renomeada S158' where id = '00000000-0000-0000-0000-000000000364';
select is((select auvo_descricao from pcm.equipamentos where id = '00000000-0000-0000-0000-000000000364'), '[TESTE] Cliente S158 - [TESTE] Área S158 - [TESTE] Local raiz S158 - Shaft S158 - [TESTE] Categoria S158 - Bomba renomeada S158', 'AC-2: update de nome recalcula');
select is((select auvo_descricao from pcm.sistemas where id = '00000000-0000-0000-0000-000000000365'), '[TESTE] Cliente S158 - [TESTE] Área S158 - [TESTE] Local raiz S158 - Shaft S158 - [TESTE] Categoria S158 - Sistema S158', 'AC-2: insert de Sistema calcula descrição');
update pcm.areas set nome = '[TESTE] Área renomeada S158' where id = '00000000-0000-0000-0000-000000000360';
select is((select auvo_descricao from pcm.equipamentos where id = '00000000-0000-0000-0000-000000000364'), '[TESTE] Cliente S158 - [TESTE] Área renomeada S158 - [TESTE] Local raiz S158 - Shaft S158 - [TESTE] Categoria S158 - Bomba renomeada S158', 'AC-3: rename de Área propaga para Componente');
select is((select auvo_descricao from pcm.sistemas where id = '00000000-0000-0000-0000-000000000365'), '[TESTE] Cliente S158 - [TESTE] Área renomeada S158 - [TESTE] Local raiz S158 - Shaft S158 - [TESTE] Categoria S158 - Sistema S158', 'AC-3: rename de Área propaga para Sistema');
update pcm.locais set nome = 'Shaft renomeado S158' where id = '00000000-0000-0000-0000-000000000362';
select is((select auvo_descricao from pcm.equipamentos where id = '00000000-0000-0000-0000-000000000364'), '[TESTE] Cliente S158 - [TESTE] Área renomeada S158 - [TESTE] Local raiz S158 - Shaft renomeado S158 - [TESTE] Categoria S158 - Bomba renomeada S158', 'AC-3: rename de Local propaga para Componente');
select is((select auvo_descricao from pcm.sistemas where id = '00000000-0000-0000-0000-000000000365'), '[TESTE] Cliente S158 - [TESTE] Área renomeada S158 - [TESTE] Local raiz S158 - Shaft renomeado S158 - [TESTE] Categoria S158 - Sistema S158', 'AC-3: rename de Local propaga para Sistema');
update pcm.clientes set nome = '[TESTE] Cliente renomeado S158' where id = '00000000-0000-0000-0000-000000000359';
select is((select auvo_descricao from pcm.equipamentos where id = '00000000-0000-0000-0000-000000000364'), '[TESTE] Cliente S158 - [TESTE] Área renomeada S158 - [TESTE] Local raiz S158 - Shaft renomeado S158 - [TESTE] Categoria S158 - Bomba renomeada S158', 'AC-3: rename de Cliente não propaga para Componente');
select is((select auvo_descricao from pcm.sistemas where id = '00000000-0000-0000-0000-000000000365'), '[TESTE] Cliente S158 - [TESTE] Área renomeada S158 - [TESTE] Local raiz S158 - Shaft renomeado S158 - [TESTE] Categoria S158 - Sistema S158', 'AC-3: rename de Cliente não propaga para Sistema');

reset role;
select * from finish();
rollback;
