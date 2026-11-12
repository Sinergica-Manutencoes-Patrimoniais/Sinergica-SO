-- evolution_canal_estado.test.sql — pgTAP (E02-S35)
-- Backfill sem adivinhação (AC-10) e sincronia estado_conexao <-> status_conexao legado.
-- Rodar com `supabase test db` (requer Docker/Supabase local).

begin;
select plan(8);

-- 1-3: colunas novas existem com os defaults corretos
select has_column('atendimento', 'canais_externos', 'provedor', 'provedor existe');
select has_column('atendimento', 'canais_externos', 'estado_conexao', 'estado_conexao existe');
select has_column('atendimento', 'canais_externos', 'saude', 'saude existe');

-- backfill: canal evolution sem prova anterior vira provedor correto
insert into atendimento.canais_externos (tipo, label, identificador_externo, status_conexao, ativo)
values ('evolution', 'Canal teste S35', 'teste-s35-instancia', 'desconectado', true);

select is(
  (select provedor from atendimento.canais_externos where identificador_externo = 'teste-s35-instancia'),
  'evolution-api',
  'canal tipo=evolution recebe provedor=evolution-api, sem palpite'
);

-- trigger: estado_conexao='conectado_verificado' projeta status_conexao='conectado' (legado)
update atendimento.canais_externos
   set estado_conexao = 'conectado_verificado'
 where identificador_externo = 'teste-s35-instancia';

select is(
  (select status_conexao from atendimento.canais_externos where identificador_externo = 'teste-s35-instancia'),
  'conectado',
  'estado_conexao conectado_verificado projeta status_conexao=conectado (compat legado)'
);

-- trigger: saude='degradada' projeta status_conexao='erro', mesmo com estado não-conectado
update atendimento.canais_externos
   set estado_conexao = 'desconectado', saude = 'degradada'
 where identificador_externo = 'teste-s35-instancia';

select is(
  (select status_conexao from atendimento.canais_externos where identificador_externo = 'teste-s35-instancia'),
  'erro',
  'saude degradada projeta status_conexao=erro'
);

-- 7: CHECK recusa estado inválido
select throws_ok(
  $$ update atendimento.canais_externos set estado_conexao = 'estado_invalido'
     where identificador_externo = 'teste-s35-instancia' $$,
  '23514',
  null,
  'estado_conexao fora do enum é recusado pelo CHECK'
);

-- 8: CHECK recusa provedor inválido
select throws_ok(
  $$ update atendimento.canais_externos set provedor = 'provedor_qualquer'
     where identificador_externo = 'teste-s35-instancia' $$,
  '23514',
  null,
  'provedor fora do enum é recusado pelo CHECK'
);

select * from finish();
rollback;
