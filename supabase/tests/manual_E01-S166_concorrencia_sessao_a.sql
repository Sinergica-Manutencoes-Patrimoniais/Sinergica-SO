begin;
set local timezone='UTC';
set local request.jwt.claims='{"sub":"16630000-1111-4000-8000-000000000001","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;
set local application_name='sso-s166-concorrencia-a';
select pcm.sso_materializar_ciclo_canonico('16630000-1111-4000-8000-000000000061','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date);
select pg_sleep(20);
commit;
