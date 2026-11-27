-- E04-S06_unidade_custo_hora.test.sql — pgTAP (DEF-23)
--
-- `_fn_custo_hora_funcionario` devolvia centavos/hora e a rentabilidade lia como reais/hora,
-- multiplicando por 100: o custo de mão de obra saía 100x maior. Números conferidos à mão:
--   R$ 5.000,00/mês ÷ 200 h base = R$ 25,00/hora = 2500 centavos/hora
--   OS de 2 h  →  R$ 50,00  =  5000 centavos   (a conta antiga gravava 500000 = R$ 5.000,00)
-- Rodar com `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select plan(11);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('23000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','def23-custohora@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now());
insert into pcm.clientes(id,nome,created_by) values
('23000000-0000-4000-8000-000000000002','DEF-23 cliente de teste','23000000-0000-4000-8000-000000000001');
insert into pcm.funcionarios(id,nome,cargo,ativo) values
('23000000-0000-4000-8000-000000000003','Técnico DEF-23','tecnico-def23',true);
-- R$ 5.000,00/mês, 200 h base.
insert into financeiro.custos_funcionario(funcionario_id,custo_mensal_centavos,horas_mes_base,vigente_desde) values
('23000000-0000-4000-8000-000000000003',500000,200.0,current_date - 365);
-- Uma OS finalizada de 2 h no mês corrente.
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,status,prioridade,origem,created_by,data_agendada,tecnico_funcionario_id,auvo_detalhes)
values ('23000000-0000-4000-8000-000000000004','23000000-0000-4000-8000-000000000002','DEF23-1','OS de 2 horas','corretiva','finalizado','normal','manual','23000000-0000-4000-8000-000000000001',current_date,'23000000-0000-4000-8000-000000000003','{"duracaoHoras":"2"}'::jsonb);

-- O cálculo ponto-no-tempo, sozinho: 500000 / 200 = 2500 centavos/hora (R$ 25,00).
select is(financeiro._fn_custo_hora_centavos_funcionario('23000000-0000-4000-8000-000000000003',current_date),
  2500::numeric,'R$ 5.000/mês em 200h dá 2500 centavos/hora (R$ 25,00)');
select is(financeiro._fn_custo_hora_centavos_funcionario('23000000-0000-4000-8000-000000000003',current_date - 400),
  null,'sem custo vigente na data devolve null, não zero');
-- O nome antigo, que era lido como reais, não existe mais.
select is(to_regprocedure('financeiro._fn_custo_hora_funcionario(uuid,date)'),null,
  'o nome antigo sai de circulação');
select ok(not has_function_privilege('anon','financeiro._fn_custo_hora_centavos_funcionario(uuid,date)','EXECUTE'),
  'anon não tem EXECUTE no helper interno');
select ok(not has_function_privilege('service_role','financeiro._fn_custo_hora_centavos_funcionario(uuid,date)','EXECUTE'),
  'service_role não tem EXECUTE no helper interno');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"23000000-0000-4000-8000-000000000001","role":"authenticated","user_modulos":{"financeiro":"leitura"}}',true);
select throws_ok(
  $$select financeiro._fn_custo_hora_centavos_funcionario('23000000-0000-4000-8000-000000000003',current_date)$$,
  '42501','permission denied for function _fn_custo_hora_centavos_funcionario',
  'authenticated com leitura financeira usa as RPCs, sem acesso direto ao helper');

-- Agregado da tela: 2 h × R$ 25,00 = R$ 50,00 = 5000 centavos. Antes do fix: 500000.
select is(
  (select custo_mo_centavos from financeiro.fn_rentabilidade_cliente_mes(12)
    where cliente_id='23000000-0000-4000-8000-000000000002' and mes=date_trunc('month',current_date)::date),
  5000::bigint,'rentabilidade: 2h a R$25,00/h custam 5000 centavos, não 500000');
select is(
  (select horas_valoradas from financeiro.fn_rentabilidade_cliente_mes(12)
    where cliente_id='23000000-0000-4000-8000-000000000002' and mes=date_trunc('month',current_date)::date),
  2::numeric,'as 2 horas continuam contando como valoradas');

-- Drill-down (AC-5): mesma conta, e a coluna passa a dizer a unidade.
select is(
  (select custo_mo_centavos from financeiro.fn_custo_os_por_cliente_mes('23000000-0000-4000-8000-000000000002',current_date)
    where os_id='23000000-0000-4000-8000-000000000004'),
  5000::bigint,'drill-down da OS: 5000 centavos, não 500000');
select is(
  (select custo_hora_centavos from financeiro.fn_custo_os_por_cliente_mes('23000000-0000-4000-8000-000000000002',current_date)
    where os_id='23000000-0000-4000-8000-000000000004'),
  2500::numeric,'drill-down expõe custo_hora_centavos com o valor em centavos');

select set_config('request.jwt.claims','{"sub":"23000000-0000-4000-8000-000000000001","role":"authenticated","user_modulos":{"comercial":"leitura"}}',true);
select is(financeiro.fn_custo_hora_medio_por_cargo('tecnico-def23'),2500::numeric,
  'leitura comercial continua recebendo média em centavos por hora pela RPC');

select * from finish();
rollback;
