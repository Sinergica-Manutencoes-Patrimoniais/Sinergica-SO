-- E01-S184 / SSO-018 — "Cliente marca disponibilidade, aprova e abre OS vinculada sem ver dados
-- internos" (critério de aceite do §15, SSO-018).
--
-- POR QUE ESTE TESTE EXISTE
-- O confronto do Caderno registrou que "não existe nenhuma função que permita ao Cliente
-- criar/abrir uma OS pelo portal". Lendo o código, a capacidade existe: aprovar o orçamento pelo
-- portal cria Chamado + OS vinculada e devolve o id da OS (`pcm.portal_decidir_orcamento`,
-- evoluída até a 0151, hoje alcançada só pela borda `_seguro` da 0233). O que NÃO existia era
-- prova: os testes de portal cobriam recusa e os caminhos de negação, nunca a aprovação. Sem
-- prova do caminho de sucesso, "existe no código" não é homologável — e este é o item que o
-- próprio confronto classificou como a lacuna de teste mais sensível, por envolver dado exposto
-- a terceiro.
begin;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('18450000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's184-sindico@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('18450000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's184-sindico-outro@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('18450000-0000-4000-8000-000000000001', 'cliente-sindico', 'Síndico do Cliente A', true),
 ('18450000-0000-4000-8000-000000000002', 'cliente-sindico', 'Síndico do Cliente B', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('18450000-0000-4000-8000-00000000000a', 'Cliente A S184', true, '18450000-0000-4000-8000-000000000001'),
 ('18450000-0000-4000-8000-00000000000b', 'Cliente B S184', true, '18450000-0000-4000-8000-000000000001');
insert into config.usuario_cliente (user_id, cliente_id) values
 ('18450000-0000-4000-8000-000000000001', '18450000-0000-4000-8000-00000000000a'),
 ('18450000-0000-4000-8000-000000000002', '18450000-0000-4000-8000-00000000000b');

insert into pcm.requisicoes_servico (id, cliente_id, titulo, descricao, status, created_by) values
 ('18450000-0000-4000-8000-00000000001a', '18450000-0000-4000-8000-00000000000a', 'Troca de disjuntor do quadro geral', 'Solicitação do síndico', 'aguardando_aceite', '18450000-0000-4000-8000-000000000001');
-- `itens` carrega custo interno de propósito: a view pública tem que derrubá-lo.
insert into pcm.orcamentos_servico (id, requisicao_id, cliente_id, numero, titulo, descricao, itens, valor_total_centavos, status, created_by) values
 ('18450000-0000-4000-8000-00000000002a', '18450000-0000-4000-8000-00000000001a', '18450000-0000-4000-8000-00000000000a', 'ORC-S184-001',
  'Troca de disjuntor do quadro geral', 'Material e mão de obra',
  '[{"descricao":"Disjuntor 40A","quantidade":2,"custo_centavos":9000,"markup":1.5,"margem_centavos":4500}]'::jsonb,
  45000, 'pendente', '18450000-0000-4000-8000-000000000001');

set local request.jwt.claims = '{"sub":"18450000-0000-4000-8000-000000000001","role":"authenticated","user_role":"cliente-sindico","cliente_id":"18450000-0000-4000-8000-00000000000a"}';
set local role authenticated;

-- Antes de aprovar: o Cliente vê o orçamento, mas não o que forma o preço.
select is(
  (select count(*)::int from pcm.portal_orcamentos_servico where id = '18450000-0000-4000-8000-00000000002a'),
  1, 'o síndico enxerga o próprio orçamento no portal'
);
select is(
  (select jsonb_agg(distinct chave) from pcm.portal_orcamentos_servico v,
     jsonb_array_elements(v.itens) item, jsonb_object_keys(item) chave
   where v.id = '18450000-0000-4000-8000-00000000002a'),
  '["descricao", "quantidade"]'::jsonb,
  'o item publicado só tem descrição e quantidade: custo, markup e margem não saem do banco'
);

-- O ato central do critério de aceite: aprovar abre a OS.
select (pcm.portal_decidir_orcamento_seguro('18450000-0000-4000-8000-00000000002a', 'aprovado', null)) as os_aprovada \gset
select isnt(:'os_aprovada'::text, null::text, 'aprovar pelo portal devolve o id de uma OS, não nulo');

reset role;
select is(
  (select client_id::text from pcm.ordens_servico where id = :'os_aprovada'),
  '18450000-0000-4000-8000-00000000000a', 'a OS aberta nasce no Cliente do próprio síndico'
);
select isnt(
  (select chamado_id::text from pcm.ordens_servico where id = :'os_aprovada'), null::text,
  'a OS nasce vinculada a um Chamado — o portal não cria OS solta'
);
select is(
  (select c.status from pcm.chamados c join pcm.ordens_servico o on o.chamado_id = c.id where o.id = :'os_aprovada'),
  'convertido_os', 'o Chamado criado pelo portal já nasce convertido na OS'
);
select is(
  (select origem from pcm.ordens_servico where id = :'os_aprovada'), 'portal',
  'a origem fica registrada como portal: dá pra auditar que quem abriu foi o Cliente'
);
select is(
  (select ordem_servico_id::text from pcm.orcamentos_servico where id = '18450000-0000-4000-8000-00000000002a'),
  :'os_aprovada', 'o orçamento aprovado guarda o vínculo com a OS que ele gerou'
);

-- Duplo clique não abre uma segunda OS: o orçamento saiu de `pendente` e não é mais decidível.
set local request.jwt.claims = '{"sub":"18450000-0000-4000-8000-000000000001","role":"authenticated","user_role":"cliente-sindico","cliente_id":"18450000-0000-4000-8000-00000000000a"}';
set local role authenticated;
select throws_ok(
  $$ select pcm.portal_decidir_orcamento_seguro('18450000-0000-4000-8000-00000000002a', 'aprovado', null) $$,
  '23514', 'orcamento_nao_decidivel',
  'aprovar de novo é recusado: duplo clique no portal não abre uma 2ª OS'
);

select * from finish();
rollback;
