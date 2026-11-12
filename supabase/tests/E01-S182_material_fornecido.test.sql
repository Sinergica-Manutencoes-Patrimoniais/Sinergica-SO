-- E01-S182 (Faturáveis por origem) — ciclo de declaração e revisão de material fornecido.
-- `financeiro.sso_declarar_material_fornecido` e `sso_revisar_material_fornecido` não tinham
-- cobertura. É o caminho em que a Sinérgica declara que forneceu material de uma lista e alguém
-- do financeiro aceita ou rejeita — entra direto na conta do Cliente.
--
-- Duas regras de negócio que só ficam explícitas aqui: só se declara material de lista cuja
-- responsabilidade é da `sinergica` (lista de responsabilidade do Cliente não gera faturável),
-- e a revisão trabalha sobre a revisão exata da declaração, nunca sobre uma leitura velha.
begin;
select plan(15);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('18230000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's182-material@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('18230000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's182-material-sem@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('18230000-0000-4000-8000-000000000001', 'superadmin', 'S182 Material', true),
 ('18230000-0000-4000-8000-000000000002', 'colaborador', 'S182 Material Sem Concessão', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('18230000-0000-4000-8000-00000000000a', 'Cliente S182 Material', true, '18230000-0000-4000-8000-000000000001');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('18230000-0000-4000-8000-000000000001', 'faturavel.efetivar', '18230000-0000-4000-8000-00000000000a');

insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('18230000-0000-4000-8000-00000000001a', 'CH-S182-MAT', '18230000-0000-4000-8000-00000000000a', 'Chamado com material', '18230000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, updated_at, created_by) values
 ('18230000-0000-4000-8000-00000000002a', '18230000-0000-4000-8000-00000000000a', '18230000-0000-4000-8000-00000000001a', 'OS-S182-MAT', 'OS com material', 'corretiva', 'em_execucao', now(), '18230000-0000-4000-8000-000000000001');

insert into pcm.listas_materiais (id, cliente_id, ordem_servico_id, responsavel, texto_original, estado, revisao, criado_por) values
 ('18230000-0000-4000-8000-00000000003a', '18230000-0000-4000-8000-00000000000a', '18230000-0000-4000-8000-00000000002a', 'sinergica', 'Cabo 2,5mm e disjuntor 20A', 'levantada', 1, '18230000-0000-4000-8000-000000000001'),
 -- Lista de responsabilidade do Cliente: material dela nunca vira faturável da Sinérgica.
 ('18230000-0000-4000-8000-00000000003b', '18230000-0000-4000-8000-00000000000a', '18230000-0000-4000-8000-00000000002a', 'cliente', 'Material fornecido pelo condomínio', 'levantada', 1, '18230000-0000-4000-8000-000000000001');

set local request.jwt.claims = '{"sub":"18230000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select financeiro.sso_declarar_material_fornecido(gen_random_uuid(),gen_random_uuid(),%L,%L,1,'Cabo aplicado','Foto da instalação') $f$,
    '18230000-0000-4000-8000-00000000000a', '18230000-0000-4000-8000-00000000003a'),
  '55000', 'indisponivel', 'gate de declaração de material fechado por padrão recusa'
);

reset role;
update financeiro.sso_material_declaracao_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18230000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select financeiro.sso_declarar_material_fornecido(gen_random_uuid(),gen_random_uuid(),%L,%L,1,'   ','Foto') $f$,
    '18230000-0000-4000-8000-00000000000a', '18230000-0000-4000-8000-00000000003a'),
  '42501', 'sem_acesso_ou_dados_invalidos', 'descrição em branco é recusada'
);
select throws_ok(
  format($f$ select financeiro.sso_declarar_material_fornecido(gen_random_uuid(),gen_random_uuid(),%L,gen_random_uuid(),1,'Cabo','Foto') $f$,
    '18230000-0000-4000-8000-00000000000a'),
  '42501', 'origem_nao_encontrada_ou_sem_acesso', 'lista inexistente é recusada'
);
select throws_ok(
  format($f$ select financeiro.sso_declarar_material_fornecido(gen_random_uuid(),gen_random_uuid(),%L,%L,1,'Cabo','Foto') $f$,
    '18230000-0000-4000-8000-00000000000a', '18230000-0000-4000-8000-00000000003b'),
  '40001', 'lista_obsoleta_ou_responsabilidade_invalida', 'lista de responsabilidade do Cliente não gera material fornecido'
);
select throws_ok(
  format($f$ select financeiro.sso_declarar_material_fornecido(gen_random_uuid(),gen_random_uuid(),%L,%L,9,'Cabo','Foto') $f$,
    '18230000-0000-4000-8000-00000000000a', '18230000-0000-4000-8000-00000000003a'),
  '40001', 'lista_obsoleta_ou_responsabilidade_invalida', 'revisão de lista divergente é recusada'
);

select (financeiro.sso_declarar_material_fornecido('18230000-0000-4000-8000-0000000000e1', '18230000-0000-4000-8000-0000000000d1',
  '18230000-0000-4000-8000-00000000000a', '18230000-0000-4000-8000-00000000003a', 1, 'Cabo 2,5mm aplicado', 'Foto da instalação'))::text as declaracao \gset
select is(:'declaracao'::text, '18230000-0000-4000-8000-0000000000d1'::text, 'declaração de material fornecido é aceita');

select is(
  (financeiro.sso_declarar_material_fornecido('18230000-0000-4000-8000-0000000000e1', '18230000-0000-4000-8000-0000000000d1',
    '18230000-0000-4000-8000-00000000000a', '18230000-0000-4000-8000-00000000003a', 1, 'Cabo 2,5mm aplicado', 'Foto da instalação'))::text,
  '18230000-0000-4000-8000-0000000000d1'::text, 'replay do mesmo requestId devolve a mesma declaração'
);
select throws_ok(
  format($f$ select financeiro.sso_declarar_material_fornecido(%L,%L,%L,%L,1,'Descrição diferente','Foto') $f$,
    '18230000-0000-4000-8000-0000000000e1', '18230000-0000-4000-8000-0000000000d1',
    '18230000-0000-4000-8000-00000000000a', '18230000-0000-4000-8000-00000000003a'),
  '23505', 'request_id_conflitante', 'mesmo requestId com conteúdo diferente é recusado'
);

reset role;
set local request.jwt.claims = '{"sub":"18230000-0000-4000-8000-000000000002","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;
select throws_ok(
  format($f$ select financeiro.sso_declarar_material_fornecido(gen_random_uuid(),gen_random_uuid(),%L,%L,1,'Cabo','Foto') $f$,
    '18230000-0000-4000-8000-00000000000a', '18230000-0000-4000-8000-00000000003a'),
  '42501', 'sem_acesso_ou_dados_invalidos', 'usuário sem a concessão faturavel.efetivar não declara material'
);

-- Revisão da declaração.
reset role;
set local request.jwt.claims = '{"sub":"18230000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select financeiro.sso_revisar_material_fornecido(gen_random_uuid(),%L,1,'talvez','Motivo') $f$,
    '18230000-0000-4000-8000-0000000000d1'),
  '22023', 'dados_invalidos', 'decisão fora de aceita/rejeitada é recusada'
);
select throws_ok(
  $$ select financeiro.sso_revisar_material_fornecido(gen_random_uuid(),gen_random_uuid(),1,'aceita','Motivo') $$,
  '42501', 'sem_acesso', 'declaração inexistente é recusada'
);
select throws_ok(
  format($f$ select financeiro.sso_revisar_material_fornecido(gen_random_uuid(),%L,9,'aceita','Motivo') $f$,
    '18230000-0000-4000-8000-0000000000d1'),
  '40001', 'revisao_obsoleta', 'revisão divergente da declaração é recusada'
);

select lives_ok(
  format($f$ select financeiro.sso_revisar_material_fornecido(gen_random_uuid(),%L,1,'aceita','Material conferido na OS') $f$,
    '18230000-0000-4000-8000-0000000000d1'),
  'revisão aceitando a declaração é aplicada'
);

reset role;
select is(
  (select estado || '/' || revisao::text from financeiro.sso_material_declaracoes where id = '18230000-0000-4000-8000-0000000000d1'),
  'aceita/2'::text, 'declaração fica aceita e a revisão avança'
);

set local request.jwt.claims = '{"sub":"18230000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok(
  format($f$ select financeiro.sso_revisar_material_fornecido(gen_random_uuid(),%L,2,'rejeitada','Mudei de ideia') $f$,
    '18230000-0000-4000-8000-0000000000d1'),
  '40001', 'revisao_obsoleta', 'declaração já revisada não é revisada de novo'
);

select * from finish();
rollback;
