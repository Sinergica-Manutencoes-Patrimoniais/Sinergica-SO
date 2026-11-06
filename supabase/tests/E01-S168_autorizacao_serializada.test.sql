-- Executar em transação REPEATABLE READ; não requer abertura dos gates.
begin isolation level repeatable read;
select plan(1);
select throws_ok(
  $$select pcm.sso_mediar_finalizacao_os(null,null,null,null,null,null,null,null)$$,
  '25001', 'isolamento_autorizacao_incompativel',
  'finalização recusa snapshot persistente anterior à trava de autorização'
);
select * from finish();
rollback;
