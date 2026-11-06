-- ADR-0903: teste transacional sintético; não envia arquivo nem cria Plano/OS.
begin;
\ir E01-S168_origem_calendario_valida_fixture.sql
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
insert into config.sso_acoes(codigo,modulo,nivel,exige_concessao_individual) values('plano.gerir','pcm','escrita',false) on conflict do nothing;
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values('16891000-0000-4000-8000-000000000001','plano.gerir','16891000-0000-4000-8000-000000000002');
insert into pcm.clientes(id,nome,ativo,created_by) values('16891000-0000-4000-8000-000000000099','Outro Cliente sintético',true,'16891000-0000-4000-8000-000000000001');
insert into pcm.sso_levantamentos(id,cliente_id,origem,chave_origem,conteudo,criado_por)
values('16900000-0000-4000-8000-000000000113','16891000-0000-4000-8000-000000000099','planilha','cronograma:outro','[[1],[2],[3],[4],[5]]','16891000-0000-4000-8000-000000000001');
update pcm.sso_cronograma_staging_gate set habilitado=true where id;
update pcm.sso_mediacao_cronograma_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
select plan(12);
select ok(not has_function_privilege('authenticated','pcm.sso_receber_xlsx_cronograma(uuid,uuid,uuid,text,jsonb,text,text)','execute'),'núcleo XLSX permanece privado');
-- Somente nesta transação: exercita o núcleo legado sem expô-lo no produto.
grant execute on function pcm.sso_receber_xlsx_cronograma(uuid,uuid,uuid,text,jsonb,text,text) to authenticated;
set local role authenticated;
select throws_ok($$select pcm.sso_receber_xlsx_cronograma('16900000-0000-4000-8000-000000000101','16900000-0000-4000-8000-000000000102','16891000-0000-4000-8000-000000000002','fonte','[[1],[2],[3],[4],[5]]','YWJj','ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')$$,'55000','origem_xlsx_bloqueada','gate fechado impede recepção');
reset role;
update pcm.sso_origem_xlsx_cronograma_gate set habilitado=true where id;
set local role authenticated;
select throws_ok($$select pcm.sso_receber_xlsx_cronograma('16900000-0000-4000-8000-000000000101','16900000-0000-4000-8000-000000000102','16891000-0000-4000-8000-000000000002','fonte','[[1],[2],[3],[4],[5]]','YWJj',repeat('0',64))$$,'22023','digest_divergente','recusa hash diferente');
select lives_ok($$select pcm.sso_receber_xlsx_cronograma('16900000-0000-4000-8000-000000000101','16900000-0000-4000-8000-000000000102','16891000-0000-4000-8000-000000000002','fonte','[[1],[2],[3],[4],[5]]','YWJj','ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')$$,'recebe matriz e origem atomicamente');
select lives_ok($$select pcm.sso_receber_xlsx_cronograma('16900000-0000-4000-8000-000000000101','16900000-0000-4000-8000-000000000102','16891000-0000-4000-8000-000000000002','fonte','[[1],[2],[3],[4],[5]]','YWJj','ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')$$,'repetição idêntica é segura');
select throws_ok($$select pcm.sso_receber_xlsx_cronograma('16900000-0000-4000-8000-000000000101','16900000-0000-4000-8000-000000000102','16891000-0000-4000-8000-000000000002','fonte','[[1],[2],[3],[4],[5]]','ZGVm','cb8379ac2098aa165029e3938a51da0bcecfc008fd6795f401178647f96c5b34')$$,'23505','origem_xlsx_conflitante','recusa bytes diferentes');
select throws_ok($$select count(*) from pcm.sso_origens_xlsx_cronograma$$,'42501',null,'sem leitura direta dos bytes');
select throws_ok($$select pcm.sso_receber_xlsx_cronograma('16900000-0000-4000-8000-000000000103','16900000-0000-4000-8000-000000000104','16891000-0000-4000-8000-000000000098','outra','[[1],[2],[3],[4],[5]]','YWJj','ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')$$,'42501','lote_sem_acesso','nega Cliente não autorizado');
select throws_ok($$select pcm.sso_receber_xlsx_cronograma('16900000-0000-4000-8000-000000000114','16900000-0000-4000-8000-000000000113','16891000-0000-4000-8000-000000000002','fonte','[[1],[2],[3],[4],[5]]','YWJj','ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')$$,'42501','lote_sem_acesso','não informa estágio de lote de outro Cliente');
select lives_ok($$select pcm.sso_receber_cronograma_mediado('16900000-0000-4000-8000-000000000111','16900000-0000-4000-8000-000000000112','16891000-0000-4000-8000-000000000002','csv','[[1],[2],[3],[4],[5]]')$$,'cria lote CSV sem origem XLSX');
select throws_ok($$select pcm.sso_receber_xlsx_cronograma('16900000-0000-4000-8000-000000000111','16900000-0000-4000-8000-000000000112','16891000-0000-4000-8000-000000000002','csv','[[1],[2],[3],[4],[5]]','YWJj','ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')$$,'55000','origem_xlsx_exige_reconciliacao','replay de CSV não anexa origem retroativa');
reset role;
select is((select count(*)::int from pcm.sso_origens_xlsx_cronograma where lote_id='16900000-0000-4000-8000-000000000102'),1,'preserva uma origem por lote');
select * from finish();
rollback;
