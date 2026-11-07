-- Executar apenas em ambiente isolado, dentro de transação revertida e com Auvo suprimido.
begin;
set local app.auvo_sync_write = 'true';
select plan(25);
select has_function('pcm', 'sso_receber_levantamento_manual', array['uuid','uuid','text','text','jsonb'], 'RPC de recepção manual existe');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='pcm' and c.relname in ('sso_levantamentos','sso_levantamento_linhas','sso_levantamento_comandos') and c.relrowsecurity and c.relforcerowsecurity), 3, 'RLS FORCE ativa nas três tabelas');
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('17800000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's178-recepcao@example.test', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios(user_id, papel, nome, ativo) values ('17800000-0000-0000-0000-000000000001', 'colaborador', 'S178 teste', true);
insert into config.usuario_modulos(user_id, modulo, nivel) values ('17800000-0000-0000-0000-000000000001', 'pcm', 'escrita');
insert into pcm.clientes(id, nome, ativo, created_by) values
 ('17800000-0000-0000-0000-00000000000a', 'S178 A', true, '17800000-0000-0000-0000-000000000001'),
 ('17800000-0000-0000-0000-00000000000b', 'S178 B', true, '17800000-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id, acao, cliente_id) values
 ('17800000-0000-0000-0000-000000000001', 'cadastro.gerir', '17800000-0000-0000-0000-00000000000a');
set local role authenticated;
set local request.jwt.claims = '{"sub":"17800000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador"}';
select throws_ok($$select pcm.sso_receber_levantamento('17800000-0000-0000-0000-000000000109','17800000-0000-0000-0000-00000000000a','auvo','lote-falso','[]'::jsonb)$$, '42501', null, 'RPC legada não permite falsificar origem');
select throws_ok($$select pcm.sso_receber_levantamento_manual('17800000-0000-0000-0000-000000000110','17800000-0000-0000-0000-00000000000a','verificado','lote-falso','[]'::jsonb)$$, '22023', null, 'declaração não pode alegar verificação');
select lives_ok($$select pcm.sso_receber_levantamento_manual('17800000-0000-0000-0000-000000000101','17800000-0000-0000-0000-00000000000a','planilha','lote-1','[{"chave":"a:1","tipo":"area","atributos":{"nome":"Área"}},{"chave":"l:1","tipo":"local","atributos":{"nome":"Local"}}]'::jsonb)$$, 'recebe duas linhas sem gravar estrutura oficial');
select is((pcm.sso_receber_levantamento_manual('17800000-0000-0000-0000-000000000101','17800000-0000-0000-0000-00000000000a','planilha','lote-1','[{"chave":"a:1","tipo":"area","atributos":{"nome":"Área"}},{"chave":"l:1","tipo":"local","atributos":{"nome":"Local"}}]'::jsonb)->>'revision')::int, 1, 'retry idêntico devolve revisão original');
select throws_ok($$select pcm.sso_receber_levantamento_manual('17800000-0000-0000-0000-000000000101','17800000-0000-0000-0000-00000000000a','planilha','outro','[]'::jsonb)$$, '23505', null, 'requestId divergente conflita');
select lives_ok($$select pcm.sso_receber_levantamento_manual('17800000-0000-0000-0000-000000000102','17800000-0000-0000-0000-00000000000a','planilha','lote-1','[{"chave":"a:1","tipo":"area","atributos":{"nome":"Área"}},{"chave":"l:1","tipo":"local","atributos":{"nome":"Local"}}]'::jsonb)$$, 'reentrega idêntica com outro requestId não duplica lote');
select throws_ok($$select pcm.sso_receber_levantamento_manual('17800000-0000-0000-0000-000000000103','17800000-0000-0000-0000-00000000000a','planilha','lote-1','[{"chave":"a:1","tipo":"area","atributos":{"nome":"Alterado"}}]'::jsonb)$$, '23505', null, 'mesma origem com conteúdo distinto requer revisão');
select throws_ok($$select pcm.sso_receber_levantamento_manual('17800000-0000-0000-0000-000000000104','17800000-0000-0000-0000-00000000000b','planilha','lote-2','[]'::jsonb)$$, '42501', null, 'nega Cliente sem capacidade');
select throws_ok($$select pcm.sso_receber_levantamento_manual('17800000-0000-0000-0000-000000000105','17800000-0000-0000-0000-00000000000a','campo','lote-2','[{"chave":"x","tipo":"area","atributos":{},"foto":"path"}]'::jsonb)$$, '22023', null, 'não aceita evidência não verificada');
select throws_ok($$select pcm.sso_receber_levantamento_manual('17800000-0000-0000-0000-000000000106','17800000-0000-0000-0000-00000000000a','campo','lote-3','[{"chave":"x","tipo":"area","atributos":{}},{"chave":"x","tipo":"local","atributos":{}}]'::jsonb)$$, '22023', null, 'rejeita chaves duplicadas no lote');
select throws_ok($$select pcm.sso_receber_levantamento_manual('17800000-0000-0000-0000-000000000107','17800000-0000-0000-0000-00000000000a','campo','lote-4', (select jsonb_agg(jsonb_build_object('chave',i::text,'tipo','area','atributos',jsonb_build_object('observacoes',repeat('a',4000)))) from generate_series(1,300) i))$$, '22023', null, 'limite considera tamanho descomprimido do payload');
select throws_ok($$select pcm.sso_receber_levantamento_manual('17800000-0000-0000-0000-000000000111','17800000-0000-0000-0000-00000000000a','auvo','lote-1','[{"chave":"a:1","tipo":"area","atributos":{"nome":"Área"}},{"chave":"l:1","tipo":"local","atributos":{"nome":"Local"}}]'::jsonb)$$, '23505', null, 'mesma chave manual com outra declaração conflita');
select throws_ok($$select count(*) from pcm.sso_levantamentos$$, '42501', null, 'leitura direta é negada');
reset role;
select is((select count(*)::int from pcm.sso_levantamentos where cliente_id = '17800000-0000-0000-0000-00000000000a' and origem = 'manual' and meio_recepcao = 'manual' and origem_declarada = 'planilha'), 1, 'declaração não vira origem comprovada');
select is((select count(*)::int from pcm.sso_levantamentos where cliente_id = '17800000-0000-0000-0000-00000000000a'), 1, 'somente um lote persistido');
select is((select count(*)::int from pcm.sso_levantamento_linhas l join pcm.sso_levantamentos b on b.id = l.lote_id where b.cliente_id = '17800000-0000-0000-0000-00000000000a'), 2, 'somente duas linhas persistidas');
select is((select count(*)::int from audit.events where entity = 'sso_levantamentos' and payload->>'requestId' = '17800000-0000-0000-0000-000000000101'), 1, 'um evento de auditoria por recepção');
set local role service_role;
select throws_ok($$delete from pcm.sso_levantamento_linhas$$, '42501', null, 'service_role não exclui linhas diretamente');
select throws_ok($$select * from pcm.sso_levantamentos$$, '42501', null, 'service_role não lê lotes diretamente');
select throws_ok($$select * from pcm.sso_levantamento_comandos$$, '42501', null, 'service_role não lê comandos diretamente');
select throws_ok($$select pcm.sso_receber_levantamento_manual('17800000-0000-0000-0000-000000000108','17800000-0000-0000-0000-00000000000a','campo','lote-5','[]'::jsonb)$$, '42501', null, 'service_role não executa RPC diretamente');
reset role;
update config.sso_concessoes set ativa = false where usuario_id = '17800000-0000-0000-0000-000000000001' and acao = 'cadastro.gerir';
set local role authenticated;
select throws_ok($$select pcm.sso_receber_levantamento_manual('17800000-0000-0000-0000-000000000101','17800000-0000-0000-0000-00000000000a','planilha','lote-1','[{"chave":"a:1","tipo":"area","atributos":{"nome":"Área"}},{"chave":"l:1","tipo":"local","atributos":{"nome":"Local"}}]'::jsonb)$$, '42501', null, 'revogação impede replay com sessão antiga');
reset role;
select is((select count(*)::int from pcm.areas where nome = 'Área' and cliente_id = '17800000-0000-0000-0000-00000000000a'), 0, 'recepção não grava Área oficial');
select * from finish();
rollback;
