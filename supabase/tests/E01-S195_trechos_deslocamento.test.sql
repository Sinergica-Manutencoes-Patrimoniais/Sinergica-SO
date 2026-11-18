-- E01-S195 — Deslocamento: enquadramento residencial × operacional.
begin;
set local app.auvo_sync_write = 'true';
select plan(23);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('19500000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s195-tecnico@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now()),
 ('19500000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s195-sem-acesso@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values
 ('19500000-0000-4000-8000-000000000001','superadmin','Operador S195',true),
 ('19500000-0000-4000-8000-000000000002','colaborador','Sem acesso S195',true);
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('19500000-0000-4000-8000-000000000010','[TESTE] Cliente S195',true,'19500000-0000-4000-8000-000000000001'),
 ('19500000-0000-4000-8000-000000000011','[TESTE] Outro Cliente S195',true,'19500000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('19500000-0000-4000-8000-000000000001','capacidade.gerir','19500000-0000-4000-8000-000000000010'),
 ('19500000-0000-4000-8000-000000000001','visita.confirmar','19500000-0000-4000-8000-000000000010');
insert into pcm.visitas(id,cliente_id,inicio_em,fim_em,fuso,natureza,created_by) values
 ('19500000-0000-4000-8000-000000000020','19500000-0000-4000-8000-000000000010','2026-11-20 12:00+00','2026-11-20 20:00+00','America/Sao_Paulo','regular','19500000-0000-4000-8000-000000000001');

select set_config('request.jwt.claims','{"sub":"19500000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);

-- AC-F4 / gate fechado: antes de abrir, a declaração é recusada com erro nomeado — nunca com
-- "funcionou mas não fez nada".
select throws_ok(
  $$select pcm.sso_declarar_trechos_visita('19500000-0000-4000-8000-000000000030','19500000-0000-4000-8000-000000000010','19500000-0000-4000-8000-000000000020',1,0,'[{"origem":"residencia","destino":"visita_anterior","minutos":30}]'::jsonb)$$,
  '55000',
  'trechos_deslocamento_bloqueados',
  'gate fechado recusa a declaração, erro nomeado'
);
update pcm.sso_trechos_deslocamento_gate set habilitado=true where id;

-- Antes de qualquer trecho existir, a leitura ainda devolve 1 linha só pra carregar a revisão
-- atual da Visita — sem isso o primeiro envio nunca saberia que `p_revisao_visita` usar.
select is(
  (select count(*)::int from pcm.sso_listar_trechos_visita('19500000-0000-4000-8000-000000000010','19500000-0000-4000-8000-000000000020')),
  1,
  'sem trecho declarado ainda, devolve 1 linha carregando revisao_visita_atual'
);
select is(
  (select revisao_visita_atual from pcm.sso_listar_trechos_visita('19500000-0000-4000-8000-000000000010','19500000-0000-4000-8000-000000000020')),
  1,
  'revisao_visita_atual reflete a Visita real (nasceu com revisao=1)'
);

-- AC-1/AC-2/AC-3/AC-4: dia casa → cliente A → cliente B → casa, 4 trechos, um só computável.
select is(
  (pcm.sso_declarar_trechos_visita(
    '19500000-0000-4000-8000-000000000030','19500000-0000-4000-8000-000000000010','19500000-0000-4000-8000-000000000020',1,0,
    '[
      {"origem":"residencia","destino":"visita_proxima","minutos":30},
      {"origem":"visita_anterior","destino":"visita_proxima","minutos":20},
      {"origem":"visita_anterior","destino":"outro","minutos":15,"motivo":"retirada de material a serviço"},
      {"origem":"outro","destino":"residencia","minutos":35}
    ]'::jsonb
  ))->>'totalComputadoMinutos',
  '35',
  'AC-4: só os trechos sem residência nas pontas somam (20 + 15 = 35)'
);
select is(
  (select enquadramento from pcm.sso_listar_trechos_visita('19500000-0000-4000-8000-000000000010','19500000-0000-4000-8000-000000000020') where sequencia=1),
  'nao_computado',
  'AC-2: residência → primeiro cliente é não computado'
);
select is(
  (select enquadramento from pcm.sso_listar_trechos_visita('19500000-0000-4000-8000-000000000010','19500000-0000-4000-8000-000000000020') where sequencia=2),
  'computado',
  'AC-4: cliente → cliente é computado'
);
select is(
  (select enquadramento from pcm.sso_listar_trechos_visita('19500000-0000-4000-8000-000000000010','19500000-0000-4000-8000-000000000020') where sequencia=3),
  'computado',
  'AC-4: retirada a serviço (cliente → outro) é computado'
);
select is(
  (select enquadramento from pcm.sso_listar_trechos_visita('19500000-0000-4000-8000-000000000010','19500000-0000-4000-8000-000000000020') where sequencia=4),
  'nao_computado',
  'AC-3: último cliente → residência é não computado'
);
select is(
  (select count(*)::int from pcm.sso_listar_trechos_visita('19500000-0000-4000-8000-000000000010','19500000-0000-4000-8000-000000000020')),
  4,
  'os 4 trechos do dia ficam registrados, na ordem'
);

-- AC-2 (veículo sob guarda não muda o resultado): a tabela não tem NENHUMA coluna sobre o
-- veículo — a regra de enquadramento é só origem/destino, então não existe como esse dado
-- influenciar o resultado por engano. Prova estrutural, não um caso de dado.
select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema='pcm' and table_name='sso_trechos_deslocamento' and column_name ilike '%veiculo%'
  ),
  'AC-2: regra de enquadramento não depende de veículo sob guarda — nenhuma coluna existe pra isso'
);

-- AC-8/AC-10: nova revisão do mesmo dia (PCM edita), sugestão anterior preservada no histórico.
select is(
  (pcm.sso_declarar_trechos_visita(
    '19500000-0000-4000-8000-000000000031','19500000-0000-4000-8000-000000000010','19500000-0000-4000-8000-000000000020',1,1,
    '[{"origem":"residencia","destino":"visita_proxima","minutos":45}]'::jsonb
  ))->>'totalComputadoMinutos',
  '0',
  'AC-8: revisão nova substitui a leitura corrente (valor editado prevalece)'
);
select is(
  (select count(*)::int from pcm.sso_trechos_deslocamento where visita_id='19500000-0000-4000-8000-000000000020' and revisao=1),
  4,
  'AC-8: a revisão anterior continua gravada (sugestão fica registrada como origem, nunca apagada)'
);
select throws_ok(
  $$update pcm.sso_trechos_deslocamento set minutos=999 where visita_id='19500000-0000-4000-8000-000000000020' and revisao=1 and sequencia=1$$,
  '23514',
  'trecho_imutavel',
  'trecho é imutável — correção sempre vira revisão nova, nunca UPDATE'
);

-- Replay idempotente: mesmo request_id, mesmo payload, devolve o mesmo resultado sem duplicar linha.
select is(
  (pcm.sso_declarar_trechos_visita(
    '19500000-0000-4000-8000-000000000031','19500000-0000-4000-8000-000000000010','19500000-0000-4000-8000-000000000020',1,1,
    '[{"origem":"residencia","destino":"visita_proxima","minutos":45}]'::jsonb
  ))->>'revisao',
  '2',
  'replay devolve a mesma revisão, não cria uma terceira'
);
select is(
  (select count(*)::int from pcm.sso_trechos_deslocamento where visita_id='19500000-0000-4000-8000-000000000020'),
  5,
  'replay não duplica linha (4 da revisão 1 + 1 da revisão 2)'
);

-- Validação de entrada.
select throws_ok(
  $$select pcm.sso_declarar_trechos_visita('19500000-0000-4000-8000-000000000032','19500000-0000-4000-8000-000000000010','19500000-0000-4000-8000-000000000020',1,2,'[{"origem":"casa","destino":"visita_proxima","minutos":10}]'::jsonb)$$,
  '23514',
  null,
  'origem fora do vocabulário é recusada pelo CHECK (nunca vira enquadramento ambíguo)'
);
select throws_ok(
  $$select pcm.sso_declarar_trechos_visita('19500000-0000-4000-8000-000000000033','19500000-0000-4000-8000-000000000010','19500000-0000-4000-8000-000000000020',1,2,'[]'::jsonb)$$,
  '22023',
  'declaracao_invalida',
  'lote vazio é recusado — deslocamento é opcional (AC-10), mas um lote vazio não é uma declaração válida'
);
select throws_ok(
  $$select pcm.sso_declarar_trechos_visita('19500000-0000-4000-8000-000000000034','19500000-0000-4000-8000-000000000010','19500000-0000-4000-8000-000000000020',1,1,'[{"origem":"residencia","destino":"visita_proxima","minutos":10}]'::jsonb)$$,
  '40001',
  'revisao_anterior_obsoleta',
  'revisão desatualizada (já está em 2, tentando gravar como se fosse a partir de 1) é recusada'
);

select set_config('request.jwt.claims','{"sub":"19500000-0000-4000-8000-000000000002","role":"authenticated","user_role":"colaborador"}',true);
select throws_ok(
  $$select pcm.sso_declarar_trechos_visita('19500000-0000-4000-8000-000000000035','19500000-0000-4000-8000-000000000010','19500000-0000-4000-8000-000000000020',1,2,'[{"origem":"residencia","destino":"visita_proxima","minutos":10}]'::jsonb)$$,
  '42501',
  'sem_acesso',
  'usuário sem capacidade.gerir/visita.confirmar é recusado'
);
select throws_ok(
  $$select pcm.sso_listar_trechos_visita('19500000-0000-4000-8000-000000000010','19500000-0000-4000-8000-000000000020')$$,
  '42501',
  'sem_acesso',
  'leitura também exige a mesma capacidade'
);

select ok(not has_function_privilege('anon','pcm.sso_declarar_trechos_visita(uuid,uuid,uuid,integer,integer,jsonb)','EXECUTE'),'anon não tem EXECUTE na escrita');
select ok(not has_function_privilege('anon','pcm.sso_listar_trechos_visita(uuid,uuid)','EXECUTE'),'anon não tem EXECUTE na leitura');

-- AC-6: achado estrutural (ver plan.md) — não existe NENHUMA tabela de hora contratada do
-- Cliente neste repositório (grep exaustivo); logo não há como esta migration reduzi-la, por
-- construção. Prova que a migration não introduziu nenhuma referência a esse conceito.
select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema='pcm' and table_name='sso_trechos_deslocamento'
      and column_name ilike '%hora_contratada%'
  ),
  'AC-6: nenhuma coluna de hora contratada existe nesta tabela — nada pra reduzir automaticamente'
);

select * from finish();
rollback;
