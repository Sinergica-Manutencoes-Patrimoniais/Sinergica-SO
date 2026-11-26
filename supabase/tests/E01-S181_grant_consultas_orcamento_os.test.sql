-- E01-S181_grant_consultas_orcamento_os.test.sql — pgTAP (DEF-12)
--
-- As quatro consultas do painel de orçamento do detalhe da OS nasceram revogadas de
-- `authenticated` e nunca receberam grant: em ambiente real a tela respondia 42501 em toda
-- abertura. Este caso exige que `authenticated` consiga chamá-las, que a autorização por cliente
-- continue dentro delas e que anon e service_role sigam de fora. Rodar com `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(8);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('18110000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','def12-orcamento@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('18110000-0000-4000-8000-000000000001','superadmin','Gestor sintético DEF-12',true);
insert into pcm.clientes(id,nome,created_by) values
('18110000-0000-4000-8000-000000000002','Cliente com concessão','18110000-0000-4000-8000-000000000001'),
('18110000-0000-4000-8000-000000000003','Cliente sem concessão','18110000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
('18110000-0000-4000-8000-000000000001','material.gerir','18110000-0000-4000-8000-000000000002'),
('18110000-0000-4000-8000-000000000001','custo.ler','18110000-0000-4000-8000-000000000002'),
('18110000-0000-4000-8000-000000000001','orcamento.emitir','18110000-0000-4000-8000-000000000002');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,created_by) values
('18110000-0000-4000-8000-000000000011','18110000-0000-4000-8000-000000000002','DEF12-A','OS com orçamento','corretiva','18110000-0000-4000-8000-000000000001');
insert into pcm.listas_materiais(id,cliente_id,ordem_servico_id,responsavel,texto_original,criado_por) values
('18110000-0000-4000-8000-000000000021','18110000-0000-4000-8000-000000000002','18110000-0000-4000-8000-000000000011','cliente','2 disjuntores 25A','18110000-0000-4000-8000-000000000001');
insert into comercial.etapas_funil(id,nome,ordem,cor) values
('18110000-0000-4000-8000-000000000031','DEF-12 etapa sintética',1,'#000000');
insert into comercial.oportunidades(id,cliente_id,etapa_id,titulo) values
('18110000-0000-4000-8000-000000000041','18110000-0000-4000-8000-000000000002','18110000-0000-4000-8000-000000000031','Oportunidade aberta DEF-12');
insert into comercial.propostas(id,oportunidade_id,tipo,status,versao_atual,preco_centavos) values
('18110000-0000-4000-8000-000000000051','18110000-0000-4000-8000-000000000041','simples','rascunho',1,150000);
insert into comercial.proposta_origens_operacionais(proposta_id,ordem_servico_id,lista_materiais_id,criado_por) values
('18110000-0000-4000-8000-000000000051','18110000-0000-4000-8000-000000000011','18110000-0000-4000-8000-000000000021','18110000-0000-4000-8000-000000000001');

set local request.jwt.claims='{"sub":"18110000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

-- O defeito: antes do grant as quatro morriam em 42501 "permission denied for function".
select is(
  (select count(*)::integer from comercial.sso_listar_edicao_orcamentos_os('18110000-0000-4000-8000-000000000002','18110000-0000-4000-8000-000000000011',20,null)),
  1,'lista de orçamentos da OS responde a authenticated (DEF-12)');
select is(
  (select count(*)::integer from comercial.sso_listar_oportunidades_orcamento('18110000-0000-4000-8000-000000000002',null)),
  1,'oportunidades autorizadas respondem a authenticated (DEF-12)');
select ok(
  comercial.sso_orcamento_operacional_autorizado('18110000-0000-4000-8000-000000000051'),
  'composição do orçamento responde a authenticated');
select is(
  (select preco_centavos from comercial.sso_preco_orcamento_operacional('18110000-0000-4000-8000-000000000051')),
  150000::bigint,'preço da composição responde a authenticated');

-- O grant não afasta a autorização por cliente: ela continua dentro das funções.
select throws_ok(
  $$select * from comercial.sso_listar_edicao_orcamentos_os('18110000-0000-4000-8000-000000000003','18110000-0000-4000-8000-000000000011',20,null)$$,
  '42501','ordem_nao_encontrada_ou_sem_acesso','cliente sem concessão continua negado na lista');
select throws_ok(
  $$select * from comercial.sso_listar_oportunidades_orcamento('18110000-0000-4000-8000-000000000003',null)$$,
  '42501','cliente_nao_encontrado_ou_sem_acesso','cliente sem concessão continua negado nas oportunidades');
reset role;

select ok(
  (select bool_and(has_function_privilege('authenticated',f,'execute')) from unnest(array[
    'comercial.sso_listar_edicao_orcamentos_os(uuid,uuid,integer,uuid)',
    'comercial.sso_listar_oportunidades_orcamento(uuid,uuid)',
    'comercial.sso_orcamento_operacional_autorizado(uuid)',
    'comercial.sso_preco_orcamento_operacional(uuid)']) f),
  'as quatro consultas do painel são alcançáveis por authenticated');
select ok(
  (select bool_and(not has_function_privilege('anon',f,'execute') and not has_function_privilege('service_role',f,'execute')) from unnest(array[
    'comercial.sso_listar_edicao_orcamentos_os(uuid,uuid,integer,uuid)',
    'comercial.sso_listar_oportunidades_orcamento(uuid,uuid)',
    'comercial.sso_orcamento_operacional_autorizado(uuid)',
    'comercial.sso_preco_orcamento_operacional(uuid)']) f)
  and not has_function_privilege('authenticated','comercial.sso_listar_orcamentos_os(uuid,uuid,integer,uuid)','execute')
  and not has_function_privilege('authenticated','comercial.sso_orcamento_sem_oportunidade(uuid)','execute'),
  'anon e service_role seguem fora, e os núcleos internos permanecem privados');

select * from finish();
rollback;
