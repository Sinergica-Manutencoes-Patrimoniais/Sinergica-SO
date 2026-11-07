begin;
set local request.jwt.claims='{"sub":"16610000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
set local application_name='sso-visita-geracao-a';
select pcm.sso_preparar_visita_canonica('16610000-0000-0000-0000-000000000197','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000198','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123','16610000-0000-0000-0000-000000000081',1,'fonte teste');
select pg_sleep(20);
commit;
