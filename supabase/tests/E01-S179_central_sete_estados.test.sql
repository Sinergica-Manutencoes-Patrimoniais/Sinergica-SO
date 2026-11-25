-- Regressão: o filtro da 1095 continuava com quatro estados após a 1843.
begin;
select plan(9);
update pcm.sso_central_materiais_mediada_gate set habilitado=false where id;
select throws_ok($$select pcm.sso_consultar_central_materiais_situacao('17910000-0000-4000-8000-000000000010',null,null,'aguardando_aquisicao',20,null)$$,'55000',null,'aquisição é estado válido, gate ainda protege');
select throws_ok($$select pcm.sso_consultar_central_materiais_situacao('17910000-0000-4000-8000-000000000010',null,null,'dispensada',20,null)$$,'55000',null,'dispensada é estado válido');
select throws_ok($$select pcm.sso_consultar_central_materiais_situacao('17910000-0000-4000-8000-000000000010',null,null,'concluida',20,null)$$,'55000',null,'concluída é estado válido');
select throws_ok($$select pcm.sso_consultar_central_materiais_situacao('17910000-0000-4000-8000-000000000010',null,null,'inexistente',20,null)$$,'22023',null,'estado desconhecido continua recusado');
update pcm.sso_central_materiais_mediada_gate set habilitado=true where id;
set local role authenticated;
set local request.jwt.claims='{"role":"authenticated"}';
select throws_ok($$select pcm.sso_consultar_central_materiais_situacao('17910000-0000-4000-8000-000000000010',null,null,'concluida',20,null)$$,'42501',null,'sem identidade não lê mesmo com gate aberto');
reset role;
select is((select habilitado from pcm.sso_criacao_materiais_mediada_gate where id),true,'criação mediada aberta');
select is((select habilitado from pcm.sso_edicao_materiais_mediada_gate where id),true,'edição mediada aberta');
select is((select habilitado from pcm.sso_eventos_materiais_mediados_gate where id),true,'eventos mediados abertos');
select is((select habilitado from pcm.sso_listagem_materiais_mediada_gate where id),true,'listagem mediada aberta');
select * from finish();
rollback;

