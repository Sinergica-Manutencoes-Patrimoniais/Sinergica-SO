-- Apenas clone descartável, migration 1813; dados sintéticos e rollback.
begin;
do $$ begin
 if (select habilitado from pcm.sso_hierarquia_grupos_mediada_gate where id) is distinct from false then raise exception 'gate_inicial_invalido'; end if;
 if not has_function_privilege('authenticated','pcm.sso_listar_hierarquia_grupos_mediada(uuid,uuid,uuid,integer)','execute')
 or has_function_privilege('anon','pcm.sso_listar_hierarquia_grupos_mediada(uuid,uuid,uuid,integer)','execute')
 or has_function_privilege('authenticated','pcm.sso_listar_hierarquia_grupos(uuid,uuid,integer)','execute') then raise exception 'acl_invalida'; end if;
end $$;
set local role authenticated;
set local request.jwt.claims='{"sub":"18130000-0000-4000-8000-000000000001","role":"authenticated","user_role":"colaborador"}';
do $$ begin
 begin
  perform * from pcm.sso_listar_hierarquia_grupos_mediada('18130000-0000-4000-8000-000000000002','18130000-0000-4000-8000-000000000003',null,20);
  raise exception 'ator_divergente_aceito';
 exception when insufficient_privilege then null; end;
 begin
  perform * from pcm.sso_listar_hierarquia_grupos_mediada('18130000-0000-4000-8000-000000000001','18130000-0000-4000-8000-000000000003',null,20);
  raise exception 'gate_fechado_aceito';
 exception when sqlstate '55000' then null; end;
end $$;
reset role;

-- Dados sintéticos; FKs e gatilhos permanecem ativos.
set local app.auvo_sync_write='true';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('18130000-0000-4000-8000-000000000011','00000000-0000-0000-0000-000000000000','authenticated','authenticated','hierarquia-a@example.test','','{}','{}',now(),now()),
 ('18130000-0000-4000-8000-000000000012','00000000-0000-0000-0000-000000000000','authenticated','authenticated','hierarquia-b@example.test','','{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('18130000-0000-4000-8000-000000000011','colaborador','Ator A',true),('18130000-0000-4000-8000-000000000012','colaborador','Ator B',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values ('18130000-0000-4000-8000-000000000011','pcm','leitura'),('18130000-0000-4000-8000-000000000012','pcm','leitura');
insert into pcm.clientes(id,nome,ativo,created_by) values ('18130000-0000-4000-8000-000000000021','Cliente A',true,'18130000-0000-4000-8000-000000000011'),('18130000-0000-4000-8000-000000000022','Cliente B',true,'18130000-0000-4000-8000-000000000012');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('18130000-0000-4000-8000-000000000011','cadastro.ler','18130000-0000-4000-8000-000000000021'),('18130000-0000-4000-8000-000000000012','cadastro.ler','18130000-0000-4000-8000-000000000022');
insert into pcm.areas(id,cliente_id,nome) values ('18130000-0000-4000-8000-000000000031','18130000-0000-4000-8000-000000000021','Área A');
insert into pcm.locais(id,area_id,nome) values ('18130000-0000-4000-8000-000000000032','18130000-0000-4000-8000-000000000031','Local A');
insert into pcm.equipamento_categorias(id,nome) values ('18130000-0000-4000-8000-000000000033','Categoria sintética');
insert into pcm.sistemas(id,cliente_id,nome) values ('18130000-0000-4000-8000-000000000034','18130000-0000-4000-8000-000000000021','Sistema A');
insert into pcm.grupos_quantitativos(id,cliente_id,local_id,categoria_id,sistema_id,nome,quantidade,created_by,updated_by) values ('18130000-0000-4000-8000-000000000035','18130000-0000-4000-8000-000000000021','18130000-0000-4000-8000-000000000032','18130000-0000-4000-8000-000000000033','18130000-0000-4000-8000-000000000034','Grupo A',3,'18130000-0000-4000-8000-000000000011','18130000-0000-4000-8000-000000000011');
update pcm.sso_hierarquia_grupos_gate set habilitado=true where id;
update pcm.sso_hierarquia_grupos_mediada_gate set habilitado=true where id;
set local role authenticated;
set local request.jwt.claims='{"sub":"18130000-0000-4000-8000-000000000011","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
do $$ begin
 if (select count(*) from pcm.sso_listar_hierarquia_grupos_mediada('18130000-0000-4000-8000-000000000011','18130000-0000-4000-8000-000000000021',null,20) where grupo_id='18130000-0000-4000-8000-000000000035' and grupo_nome='Grupo A' and quantidade=3 and local_nome='Local A' and area_nome='Área A' and sistema_nome='Sistema A' and local_estado='disponivel' and sistema_estado='disponivel') <> 1 then raise exception 'hierarquia_permitida_divergente'; end if;
end $$;
set local request.jwt.claims='{"sub":"18130000-0000-4000-8000-000000000012","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}';
do $$ begin
 begin
  perform * from pcm.sso_listar_hierarquia_grupos_mediada('18130000-0000-4000-8000-000000000012','18130000-0000-4000-8000-000000000021',null,20);
  raise exception 'outro_cliente_autorizado';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
