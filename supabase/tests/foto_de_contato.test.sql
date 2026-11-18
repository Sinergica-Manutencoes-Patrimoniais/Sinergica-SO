-- foto_de_contato.test.sql — pgTAP (E02-S40)
-- Reserva de 7 dias, guardar/apagar foto, backfill de leitura em conversas. Rodar com
-- `supabase test db`.

begin;
select plan(7);

insert into atendimento.canais_externos (id, tipo, label, identificador_externo, ativo)
values ('00000000-0000-0000-0000-000000000401', 'evolution', 'Canal S40', 'inst-s40', true)
on conflict (id) do nothing;

insert into atendimento.conversas (id, instance_id, remote_jid, canal_id)
values ('00000000-0000-0000-0000-000000000402', 'inst-s40', '5511955555555@s.whatsapp.net',
        '00000000-0000-0000-0000-000000000401')
on conflict (id) do nothing;

-- 1: primeira reserva (nunca consultado) consegue
select ok(
  (select atendimento.fn_reservar_consulta_de_foto('00000000-0000-0000-0000-000000000402')),
  'primeira consulta reserva com sucesso'
);

-- 2: segunda reserva dentro da janela de 7 dias NÃO consegue
select ok(
  (select not atendimento.fn_reservar_consulta_de_foto('00000000-0000-0000-0000-000000000402')),
  'segunda consulta dentro da janela de 7 dias é recusada'
);

-- 3: registra foto guardada
select lives_ok(
  $$ select atendimento.fn_registrar_foto_de_contato(
       '00000000-0000-0000-0000-000000000402'::uuid, 'guardada', 'image/jpeg',
       'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') $$,
  'registra foto guardada com mime e hash válidos'
);

-- 4: cópia de leitura na conversa foi preenchida
select isnt(
  (select foto_em from atendimento.conversas where id = '00000000-0000-0000-0000-000000000402'),
  null,
  'conversa.foto_em preenchido após guardar'
);

-- 5: nova consulta sem foto apaga a anterior e zera a cópia de leitura
update atendimento.foto_de_contato
   set consultada_em = clock_timestamp() - interval '8 days'
 where conversa_id = '00000000-0000-0000-0000-000000000402';
select ok(
  (select atendimento.fn_reservar_consulta_de_foto('00000000-0000-0000-0000-000000000402')),
  'fora da janela de 7 dias, reserva de novo'
);
select atendimento.fn_registrar_foto_de_contato(
  '00000000-0000-0000-0000-000000000402'::uuid, 'sem_foto', null, null
);
select is(
  (select foto_hash from atendimento.conversas where id = '00000000-0000-0000-0000-000000000402'),
  null,
  'sem_foto zera a cópia de leitura (volta a iniciais)'
);

-- 6: CHECK recusa estado 'guardada' sem mime/hash
select throws_ok(
  $$ update atendimento.foto_de_contato set estado = 'guardada', mime = null, hash = null
     where conversa_id = '00000000-0000-0000-0000-000000000402' $$,
  '23514',
  null,
  'estado guardada sem mime/hash é recusado pelo CHECK'
);

select * from finish();
rollback;
