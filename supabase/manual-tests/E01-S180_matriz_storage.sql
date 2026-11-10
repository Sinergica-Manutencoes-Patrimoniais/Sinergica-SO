-- Somente banco sintético descartável. Altera ACLs/policies apenas no rollback.
\set ON_ERROR_STOP on
begin;
set local app.auvo_sync_write='true';
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(5);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('18099000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','matriz-180@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('18099000-0000-4000-8000-000000000001','superadmin','Matriz sintética',true);

-- Simula uma condição de implantação futura com todas as ACLs liberadas.
-- Não altera o estado real dos helpers nem abre gates.
grant execute on function pcm.sso_autorizar_upload_comprovante(text),
 pcm.sso_autorizar_upload_foto_grupo(text),pcm.sso_autorizar_upload_evidencia_material(text),
 pcm.sso_autorizar_upload_foto_levantamento(text),pcm.sso_autorizar_upload_documento_levantamento(text),
 pcm.sso_autorizar_upload_evidencia_resposta(text) to authenticated;

create temp table matriz_storage(fase text, cenario text, bucket text, resultado text) on commit drop;
grant select,insert on matriz_storage to authenticated;
create function pg_temp.provar_insert(p_bucket text) returns text language plpgsql as $$
begin
  begin
    insert into storage.objects(id,bucket_id,name,owner_id)
    values (gen_random_uuid(),p_bucket,'18099000-0000-4000-8000-000000000002/arquivo','18099000-0000-4000-8000-000000000001');
    raise exception using errcode='P0001', message='reverter insert de prova';
  exception when sqlstate 'P0001' then return 'permitido';
            when others then return sqlstate;
  end;
end $$;
create function pg_temp.capturar(p_fase text) returns void language plpgsql as $$
declare c record; b record;
begin
 for c in select * from (values
   ('superadmin','{"sub":"18099000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}'),
   ('pcm','{"sub":"18099000-0000-4000-8000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}'),
   ('cliente','{"sub":"18099000-0000-4000-8000-000000000001","role":"authenticated","user_role":"cliente-sindico","cliente_id":"18099000-0000-4000-8000-000000000002"}'),
   ('sem-sub','{"role":"authenticated"}')
 ) x(cenario,claims) loop
  perform set_config('request.jwt.claims',c.claims,true);
  for b in select unnest(array['atendimento-midias','chamados-anexos','financeiro-comprovantes','inspecoes-midia','pmoc-laudos','portal-chamados-anexos','os-anexos','sso-despesas-visita','sso-grupos-fotos','sso-material-evidencias','sso-levantamento-fotos','sso-levantamento-documentos','sso-retorno-evidencias']) as bucket loop
   insert into matriz_storage values (p_fase,c.cenario,b.bucket,pg_temp.provar_insert(b.bucket));
  end loop;
 end loop;
end $$;
set local role authenticated;
select pg_temp.capturar('original');
reset role;

-- Aplicação experimental dos wrappers da 0996, somente nesta transação.
create function pcm.sso_teste_dispatch_matriz(p_bucket text,p_nome text,p_owner text)
returns boolean language sql volatile security definer set search_path='' as $$
 select pcm.sso_s180_dispatch_storage_experimental(p_bucket,p_nome,p_owner)
$$;
create function pcm.sso_teste_guard_matriz(p_bucket text)
returns boolean language sql stable security definer set search_path='' as $$
 select pcm.sso_s180_guard_storage_experimental(p_bucket)
$$;
revoke all on function pcm.sso_teste_dispatch_matriz(text,text,text),pcm.sso_teste_guard_matriz(text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_teste_dispatch_matriz(text,text,text),pcm.sso_teste_guard_matriz(text) to authenticated;
do $$
declare r record;
begin
 for r in select * from (values
  ('s180_upload_comprovante','s180_limitar_upload_comprovante','sso-despesas-visita'),
  ('s176_foto_upload','s176_foto_upload_restrito','sso-grupos-fotos'),
  ('s179_evidencia_upload','s179_evidencia_upload_restrito','sso-material-evidencias'),
  ('s178_foto_upload','s178_foto_upload_restrito','sso-levantamento-fotos'),
  ('s178_documento_upload','s178_documento_upload_restrito','sso-levantamento-documentos'),
  ('s168_evidencia_upload','s168_evidencia_upload_restrito','sso-retorno-evidencias')
 ) x(permissiva,restritiva,bucket) loop
  execute format('alter policy %I on storage.objects with check (bucket_id=%L and pcm.sso_teste_dispatch_matriz(bucket_id,name,owner_id))',r.permissiva,r.bucket);
  execute format('alter policy %I on storage.objects with check (bucket_id<>%L or pcm.sso_teste_dispatch_matriz(bucket_id,name,owner_id))',r.restritiva,r.bucket);
 end loop;
end $$;
create policy s180_teste_guard_matriz on storage.objects as restrictive for insert to authenticated with check (pcm.sso_teste_guard_matriz(bucket_id));
set local role authenticated;
select pg_temp.capturar('candidato');
reset role;
select is((select count(*)::integer from matriz_storage where fase='original'),52,'52 combinações originais capturadas');
select is((select count(*)::integer from matriz_storage a join matriz_storage b using(cenario,bucket) where a.fase='original' and b.fase='candidato' and a.resultado is distinct from b.resultado),0,'decisões iguais com ACLs abertas e gates fechados');
select ok((select count(*) > 0 from matriz_storage where fase='original' and resultado='permitido'),'matriz contém acessos permitidos');
select ok((select count(*) > 0 from matriz_storage where fase='original' and resultado='42501'),'matriz contém acessos negados');
set local role anon;
select throws_ok($$insert into storage.objects(id,bucket_id,name,owner_id) values(gen_random_uuid(),'sso-despesas-visita','x','18099000-0000-4000-8000-000000000001')$$,'42501',null,'anon não insere comprovante');
reset role;
select * from finish();
rollback;
