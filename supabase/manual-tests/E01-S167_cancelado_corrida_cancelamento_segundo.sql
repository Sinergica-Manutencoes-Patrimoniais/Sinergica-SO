begin;
select set_config('request.jwt.claims','{"sub":"16795001-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);
select pcm.sso_cancelar_chamado_conservador(:'request','16795001-0000-4000-8000-00000000000a','16795001-0000-4000-8000-000000000011',(select sso_revisao from pcm.chamados where id='16795001-0000-4000-8000-000000000011'),'Teste sintético');
commit;
