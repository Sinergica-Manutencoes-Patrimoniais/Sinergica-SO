-- Executar apenas em banco isolado: requer fixture e migration carregadas na mesma transação.
begin;
\ir E01-S168_finalizacao_fixture_real.sql
select plan(4);
update pcm.sso_finalizar_os_validada_gate set habilitado=true where id;
update pcm.sso_atestacao_pcm_gate set habilitado=true where id;
update pcm.validacao_os_gate set habilitado=true where id;
update pcm.sso_upload_evidencia_resposta_gate set habilitado=true where id;
update pcm.sso_validacao_resposta_gate set habilitado=true where id;
grant execute on function pcm.sso_finalizar_os_validada_v2(uuid,uuid,uuid,uuid,uuid,integer,text,timestamptz) to authenticated;
select updated_at as os_updated_at from pcm.ordens_servico where id='16891000-0000-4000-8000-000000000017' \gset
set local request.jwt.claims = '{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok(format($$select pcm.sso_finalizar_os_validada_v2('16891000-0000-4000-8000-000000000035','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000018','16891000-0000-4000-8000-000000000020','16891000-0000-4000-8000-000000000034',1,'em_execucao',%L::timestamptz)$$, :'os_updated_at'), '40001', null, 'alvo divergente não finaliza');
select throws_ok(format($$select pcm.sso_finalizar_os_validada_v2('16891000-0000-4000-8000-000000000035','16891000-0000-4000-8000-000000000020','16891000-0000-4000-8000-000000000018','16891000-0000-4000-8000-000000000017','16891000-0000-4000-8000-000000000034',1,'em_execucao',%L::timestamptz)$$, :'os_updated_at'), '42501', null, 'Cliente divergente é negado');
select is((pcm.sso_finalizar_os_validada_v2('16891000-0000-4000-8000-000000000035','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000018','16891000-0000-4000-8000-000000000017','16891000-0000-4000-8000-000000000034',1,'em_execucao',:'os_updated_at'::timestamptz)->>'status'), 'finalizado', 'finalização com FKs reais é efetuada');
select is((pcm.sso_finalizar_os_validada_v2('16891000-0000-4000-8000-000000000035','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000018','16891000-0000-4000-8000-000000000017','16891000-0000-4000-8000-000000000034',1,'em_execucao',:'os_updated_at'::timestamptz)->>'status'), 'finalizado', 'retry devolve resultado original');
reset role;
select * from finish();
rollback;
