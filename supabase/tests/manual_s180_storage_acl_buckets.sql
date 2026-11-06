-- SOMENTE banco descartável. Testa negação SQL por ACL; nenhum byte é enviado.
begin;
set local app.auvo_sync_write='true';
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(7);
set local request.jwt.claims = '{"sub":"18098000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok(format('insert into storage.objects(id,bucket_id,name,owner_id) values (%L,%L,%L,%L)', id, bucket, 'diagnostico/arquivo', '18098000-0000-4000-8000-000000000001'), '42501', null, 'sem concessão explícita: ' || bucket)
from (values
 ('18098000-0000-4000-8000-000000000011','sso-despesas-visita'),
 ('18098000-0000-4000-8000-000000000012','sso-grupos-fotos'),
 ('18098000-0000-4000-8000-000000000013','sso-material-evidencias'),
 ('18098000-0000-4000-8000-000000000014','sso-levantamento-fotos'),
 ('18098000-0000-4000-8000-000000000015','sso-levantamento-documentos'),
 ('18098000-0000-4000-8000-000000000016','sso-retorno-evidencias'),
 ('18098000-0000-4000-8000-000000000017','atendimento-midias')
) t(id,bucket);
select * from finish();
rollback;
