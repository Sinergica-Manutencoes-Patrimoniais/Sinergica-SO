-- E01-S179_rollout_consulta_versoes_materiais.test.sql — pgTAP (DEF-11)
--
-- A 0411 criou as consultas do ADR-0185 revogadas de todos os papéis ("revogadas até rollout") e a
-- tela "Organizar linhas" entrou chamando-as como `authenticated`. Sem a concessão do rollout, toda
-- abertura do editor recebe 42501 e a tela responde "Não foi possível consultar as linhas", sempre.
-- Este caso exige que `authenticated` consiga chamar as duas, que a autorização por cliente continue
-- valendo dentro delas, e que anon e service_role sigam de fora. Rodar com `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(8);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('17991100-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','def11-linhas@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('17991100-0000-4000-8000-000000000001','superadmin','Gestor sintético DEF-11',true);
insert into pcm.clientes(id,nome,created_by) values
('17991100-0000-4000-8000-000000000002','Cliente com concessão','17991100-0000-4000-8000-000000000001'),
('17991100-0000-4000-8000-000000000003','Cliente sem concessão','17991100-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('17991100-0000-4000-8000-000000000001','material.gerir','17991100-0000-4000-8000-000000000002');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,created_by) values
('17991100-0000-4000-8000-000000000011','17991100-0000-4000-8000-000000000002','DEF11-A','OS autorizada','corretiva','17991100-0000-4000-8000-000000000001'),
('17991100-0000-4000-8000-000000000012','17991100-0000-4000-8000-000000000003','DEF11-B','OS de outro cliente','corretiva','17991100-0000-4000-8000-000000000001');
-- Lista na revisão 2: a revisão 1 é a criação, que não gera snapshot de linhas.
insert into pcm.listas_materiais(id,cliente_id,ordem_servico_id,responsavel,texto_original,revisao,criado_por) values
('17991100-0000-4000-8000-000000000021','17991100-0000-4000-8000-000000000002','17991100-0000-4000-8000-000000000011','cliente','2 disjuntores 25A',2,'17991100-0000-4000-8000-000000000001'),
('17991100-0000-4000-8000-000000000022','17991100-0000-4000-8000-000000000003','17991100-0000-4000-8000-000000000012','cliente','lista alheia',1,'17991100-0000-4000-8000-000000000001'),
('17991100-0000-4000-8000-000000000023','17991100-0000-4000-8000-000000000002','17991100-0000-4000-8000-000000000011','cliente','lista recém-criada, ainda sem organização',1,'17991100-0000-4000-8000-000000000001');
insert into pcm.sso_lista_materiais_versoes(lista_id,revisao,linhas,criado_por) values
('17991100-0000-4000-8000-000000000021',2,'[{"descricao":"disjuntor 25A","quantidade":"2","unidade":"un","trechosOriginais":["2 disjuntores 25A"]}]'::jsonb,'17991100-0000-4000-8000-000000000001');

set local request.jwt.claims='{"sub":"17991100-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

-- O defeito: antes do rollout as duas chamadas morriam em 42501 "permission denied for function".
select lives_ok(
  $$select pcm.sso_obter_linhas_materiais_vigentes('17991100-0000-4000-8000-000000000021',2)$$,
  'authenticated consegue consultar as linhas vigentes (DEF-11)');
select is(
  (select jsonb_array_length(pcm.sso_obter_linhas_materiais_vigentes('17991100-0000-4000-8000-000000000021',2))),
  1,'devolve o snapshot de linhas da revisão pedida');
select is(
  (select count(*)::integer from pcm.sso_listar_versoes_materiais('17991100-0000-4000-8000-000000000021',null,20)),
  1,'authenticated consegue listar as versões (histórico do editor)');
-- Lista sem snapshot: null é resposta legítima, não erro — a UI mantém o texto original.
select is(
  pcm.sso_obter_linhas_materiais_vigentes('17991100-0000-4000-8000-000000000023',1),
  null,'sem versão gravada devolve null em vez de falhar');

-- O grant não afasta a autorização por cliente: ela continua dentro da função.
select throws_ok(
  $$select pcm.sso_obter_linhas_materiais_vigentes('17991100-0000-4000-8000-000000000022',1)$$,
  '42501','lista_nao_encontrada_ou_sem_acesso','cliente sem concessão continua negado');
select throws_ok(
  $$select pcm.sso_obter_linhas_materiais_vigentes('17991100-0000-4000-8000-000000000021',9)$$,
  '22023','revisao_invalida','revisão acima da atual continua recusada');
reset role;

select ok(
  has_function_privilege('authenticated','pcm.sso_obter_linhas_materiais_vigentes(uuid,integer)','execute')
  and not has_function_privilege('anon','pcm.sso_obter_linhas_materiais_vigentes(uuid,integer)','execute')
  and not has_function_privilege('service_role','pcm.sso_obter_linhas_materiais_vigentes(uuid,integer)','execute'),
  'somente authenticated chama a consulta de linhas vigentes');
select ok(
  has_function_privilege('authenticated','pcm.sso_listar_versoes_materiais(uuid,integer,integer)','execute')
  and not has_function_privilege('anon','pcm.sso_listar_versoes_materiais(uuid,integer,integer)','execute')
  and not has_function_privilege('service_role','pcm.sso_listar_versoes_materiais(uuid,integer,integer)','execute'),
  'somente authenticated lista as versões');

select * from finish();
rollback;
