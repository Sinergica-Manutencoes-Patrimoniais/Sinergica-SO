-- Migration 0971 e 0972 carregadas em transação isolada.
select plan(2);
select has_function('pcm', 'sso_mediar_finalizacao_os', array['uuid','uuid','uuid','uuid','uuid','integer','text','timestamp with time zone'], 'mediador mantém assinatura');
select throws_ok($$select pcm.sso_mediar_finalizacao_os(null,null,null,null,null,null,null,null)$$, '55000', null, 'gate fechado continua impedindo operação');
select * from finish();
