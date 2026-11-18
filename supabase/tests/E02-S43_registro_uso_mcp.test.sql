-- E02-S43 — registro de uso do MCP (AC-6/AC-8/SC-003).
begin;
set local app.auvo_sync_write = 'true';
select plan(13);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('19430000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s43-mcp-a@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now()),
 ('19430000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s43-mcp-b@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values
 ('19430000-0000-4000-8000-000000000001','superadmin','MCP A',true),
 ('19430000-0000-4000-8000-000000000002','superadmin','MCP B',true);

select set_config('request.jwt.claims','{"sub":"19430000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);

-- AC-6: toda chamada (sucesso) identifica usuário e ferramenta.
select is(
  (pcm.sso_registrar_uso_mcp('consultar_levantamento', true, null)) is not null,
  true,
  'AC-6: registro de chamada bem-sucedida devolve id'
);
select is(
  (select ator_id from pcm.sso_mcp_chamadas where ferramenta='consultar_levantamento' order by criado_em desc limit 1),
  '19430000-0000-4000-8000-000000000001'::uuid,
  'AC-6: ator_id registrado é o usuário real (contexto da chamada), nunca o sistema'
);

-- AC-8: chamada RECUSADA também é registrada — "ferramenta não autorizada... é recusada e o
-- evento é registrado". O registro em si (sucesso=false) é o que prova isso.
select is(
  (pcm.sso_registrar_uso_mcp('ferramenta_inexistente', false, 'ferramenta_desconhecida')) is not null,
  true,
  'AC-8: recusa também gera registro (sucesso=false)'
);
select is(
  (select sucesso from pcm.sso_mcp_chamadas where ferramenta='ferramenta_inexistente'),
  false,
  'AC-8: recusa fica marcada como sucesso=false, não unindo com as chamadas válidas'
);
select is(
  (select detalhe from pcm.sso_mcp_chamadas where ferramenta='ferramenta_inexistente'),
  'ferramenta_desconhecida',
  'AC-8: motivo da recusa é rastreável'
);

select throws_ok(
  $$select pcm.sso_registrar_uso_mcp('', true, null)$$,
  '22023','registro_invalido',
  'nome de ferramenta vazio é recusado — nunca registra em branco'
);
select throws_ok(
  $$select pcm.sso_registrar_uso_mcp(repeat('x', 101), true, null)$$,
  '22023','registro_invalido',
  'nome de ferramenta acima do limite é recusado'
);

-- AC-1/isolamento: cada usuário só enxerga SEU PRÓPRIO histórico — mesmo espírito do isolamento
-- de Cliente (AC-10 da E01-S198), aqui aplicado ao histórico de uso do próprio ator.
select is(
  (select count(*)::int from pcm.sso_listar_uso_mcp_proprio(30,null)),
  2,
  'listagem própria traz as 2 chamadas registradas por este ator (sucesso + recusa)'
);

select set_config('request.jwt.claims','{"sub":"19430000-0000-4000-8000-000000000002","role":"authenticated","user_role":"superadmin"}',true);
select is(
  pcm.sso_registrar_uso_mcp('consultar_levantamento', true, null) is not null,
  true,
  'segundo ator registra sua própria chamada'
);
select is(
  (select count(*)::int from pcm.sso_listar_uso_mcp_proprio(30,null)),
  1,
  'AC-1 (isolamento): segundo ator só enxerga a PRÓPRIA chamada, não as do primeiro ator'
);
select is(
  (select count(*)::int from pcm.sso_mcp_chamadas),
  3,
  'total real é 3 (2 do ator A + 1 do ator B) — a listagem própria é filtro, não a verdade inteira'
);

select ok(not has_table_privilege('authenticated','pcm.sso_mcp_chamadas','SELECT'),'authenticated não lê a tabela direto — só pela RPC própria (porta única)');
select ok(not has_function_privilege('anon','pcm.sso_registrar_uso_mcp(text,boolean,text)','EXECUTE'),'anon não tem EXECUTE no registro');

select * from finish();
rollback;
