begin;
set local search_path = extensions, public;
select plan(2);
update pcm.sso_guardar_impacto_aprovacao_gate set habilitado = false where id;
select throws_ok($$insert into pcm.aprovacao_revisao_tokens(txid, plano_id, versao_anterior_id, vigencia_inicio) values (txid_current(), gen_random_uuid(), gen_random_uuid(), current_date + 1)$$, '23514', 'aprovacao_bloqueada_impacto_e_fuso_nao_comprovados', 'guarda desabilitada não libera aprovação sem prova');
update pcm.sso_guardar_impacto_aprovacao_gate set habilitado = true where id;
select throws_ok($$insert into pcm.aprovacao_revisao_tokens(txid, plano_id, versao_anterior_id, vigencia_inicio) values (txid_current(), gen_random_uuid(), gen_random_uuid(), current_date + 1)$$, '23514', 'aprovacao_bloqueada_impacto_e_fuso_nao_comprovados', 'guarda habilitada continua bloqueando');
select * from finish();
rollback;
