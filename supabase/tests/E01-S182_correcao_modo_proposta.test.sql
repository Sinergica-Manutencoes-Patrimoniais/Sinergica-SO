-- E01-S182 (Faturáveis por origem) — correção do modo de faturamento já definido.
-- Par de `E01-S182_modo_faturamento_proposta.test.sql`. Enquanto `sso_definir_modo_proposta`
-- escolhe o modo pela primeira vez, `financeiro.sso_corrigir_modo_proposta` troca um modo já
-- definido, criando uma cadeia de revisões auditável. Não tinha cobertura.
--
-- Três regras que só ficam explícitas aqui: corrigir exige a revisão corrente exata (ninguém
-- corrige a partir de leitura velha); corrigir para o MESMO modo é recusado em vez de gravar
-- revisão inócua; e a correção é barrada se a origem já tem faturável vivo — mesmo cancelado, se
-- houve histórico de alocação.
begin;
select plan(11);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('18250000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's182-correcao@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('18250000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's182-correcao-sem@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('18250000-0000-4000-8000-000000000001', 'superadmin', 'S182 Correção', true),
 ('18250000-0000-4000-8000-000000000002', 'colaborador', 'S182 Correção Sem Concessão', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('18250000-0000-4000-8000-00000000000a', 'Cliente S182 Correção', true, '18250000-0000-4000-8000-000000000001');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('18250000-0000-4000-8000-000000000001', 'faturavel.efetivar', '18250000-0000-4000-8000-00000000000a');

insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('18250000-0000-4000-8000-00000000001a', 'CH-S182-CORR', '18250000-0000-4000-8000-00000000000a', 'Chamado da proposta', '18250000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, updated_at, created_by) values
 ('18250000-0000-4000-8000-00000000002a', '18250000-0000-4000-8000-00000000000a', '18250000-0000-4000-8000-00000000001a', 'OS-S182-CORR', 'OS da proposta', 'corretiva', 'em_execucao', now(), '18250000-0000-4000-8000-000000000001');
insert into pcm.listas_materiais (id, cliente_id, ordem_servico_id, responsavel, texto_original, estado, revisao, criado_por) values
 ('18250000-0000-4000-8000-00000000003a', '18250000-0000-4000-8000-00000000000a', '18250000-0000-4000-8000-00000000002a', 'sinergica', 'Disjuntor e cabo', 'levantada', 1, '18250000-0000-4000-8000-000000000001');

update comercial.sso_origem_operacional_gate set habilitado = true where id;
insert into comercial.propostas (id, tipo, status, preco_centavos, created_by) values
 ('18250000-0000-4000-8000-00000000004a', 'simples', 'aceita', 500000, '18250000-0000-4000-8000-000000000001'),
 -- Proposta B: tem modo definido e já gerou faturável vivo.
 ('18250000-0000-4000-8000-00000000004b', 'simples', 'aceita', 700000, '18250000-0000-4000-8000-000000000001'),
 -- Proposta C: aceita, mas nunca teve modo definido — não há o que corrigir.
 ('18250000-0000-4000-8000-00000000004c', 'simples', 'aceita', 300000, '18250000-0000-4000-8000-000000000001');
insert into comercial.proposta_origens_operacionais (proposta_id, ordem_servico_id, lista_materiais_id, criado_por) values
 ('18250000-0000-4000-8000-00000000004a', '18250000-0000-4000-8000-00000000002a', '18250000-0000-4000-8000-00000000003a', '18250000-0000-4000-8000-000000000001'),
 ('18250000-0000-4000-8000-00000000004b', '18250000-0000-4000-8000-00000000002a', '18250000-0000-4000-8000-00000000003a', '18250000-0000-4000-8000-000000000001'),
 ('18250000-0000-4000-8000-00000000004c', '18250000-0000-4000-8000-00000000002a', '18250000-0000-4000-8000-00000000003a', '18250000-0000-4000-8000-000000000001');

-- Modo base já definido para A e B (a definição em si é coberta no teste irmão).
insert into financeiro.sso_modo_faturamento_propostas (proposta_id, cliente_id, modo, motivo, request_id, ator_id) values
 ('18250000-0000-4000-8000-00000000004a', '18250000-0000-4000-8000-00000000000a', 'integral', 'Definição inicial', '18250000-0000-4000-8000-0000000000f1', '18250000-0000-4000-8000-000000000001'),
 ('18250000-0000-4000-8000-00000000004b', '18250000-0000-4000-8000-00000000000a', 'integral', 'Definição inicial', '18250000-0000-4000-8000-0000000000f2', '18250000-0000-4000-8000-000000000001');
insert into financeiro.itens_faturaveis (id, cliente_id, origem_tipo, origem_id, valor_original_centavos, competencia) values
 ('18250000-0000-4000-8000-00000000005b', '18250000-0000-4000-8000-00000000000a', 'proposta_operacional', '18250000-0000-4000-8000-00000000004b', 700000, date '2026-11-01');

set local request.jwt.claims = '{"sub":"18250000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select financeiro.sso_corrigir_modo_proposta(gen_random_uuid(),%L,%L,1,'linhas','Correção') $f$,
    '18250000-0000-4000-8000-00000000000a', '18250000-0000-4000-8000-00000000004a'),
  '55000', 'indisponivel', 'gate de modo de faturamento fechado por padrão recusa'
);

reset role;
update financeiro.sso_modo_faturamento_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18250000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select financeiro.sso_corrigir_modo_proposta(gen_random_uuid(),%L,%L,1,'hibrido','Correção') $f$,
    '18250000-0000-4000-8000-00000000000a', '18250000-0000-4000-8000-00000000004a'),
  '42501', 'sem_acesso_ou_dados_invalidos', 'modo fora de integral/linhas é recusado'
);
select throws_ok(
  format($f$ select financeiro.sso_corrigir_modo_proposta(gen_random_uuid(),%L,gen_random_uuid(),1,'linhas','Correção') $f$,
    '18250000-0000-4000-8000-00000000000a'),
  '42501', 'sem_acesso', 'proposta inexistente é recusada'
);
select throws_ok(
  format($f$ select financeiro.sso_corrigir_modo_proposta(gen_random_uuid(),%L,%L,1,'linhas','Correção') $f$,
    '18250000-0000-4000-8000-00000000000a', '18250000-0000-4000-8000-00000000004c'),
  '42501', 'sem_acesso', 'proposta que nunca teve modo definido não tem o que corrigir'
);

-- Revisão corrente exata: ninguém corrige a partir de leitura velha.
select throws_ok(
  format($f$ select financeiro.sso_corrigir_modo_proposta(gen_random_uuid(),%L,%L,7,'linhas','Revisão errada') $f$,
    '18250000-0000-4000-8000-00000000000a', '18250000-0000-4000-8000-00000000004a'),
  '40001', 'revisao_ou_modo_invalido', 'revisão divergente da corrente é recusada'
);
-- Corrigir para o mesmo modo não grava revisão inócua.
select throws_ok(
  format($f$ select financeiro.sso_corrigir_modo_proposta(gen_random_uuid(),%L,%L,1,'integral','Mesmo modo') $f$,
    '18250000-0000-4000-8000-00000000000a', '18250000-0000-4000-8000-00000000004a'),
  '40001', 'revisao_ou_modo_invalido', 'corrigir para o mesmo modo é recusado'
);
-- Origem com faturável vivo não aceita correção de modo.
select throws_ok(
  format($f$ select financeiro.sso_corrigir_modo_proposta(gen_random_uuid(),%L,%L,1,'linhas','Depois do faturável') $f$,
    '18250000-0000-4000-8000-00000000000a', '18250000-0000-4000-8000-00000000004b'),
  '23514', 'faturavel_ou_alocacao_existente', 'proposta com faturável vivo não troca de modo'
);

select is(
  (financeiro.sso_corrigir_modo_proposta('18250000-0000-4000-8000-0000000000e1', '18250000-0000-4000-8000-00000000000a',
    '18250000-0000-4000-8000-00000000004a', 1, 'linhas', 'Cliente pediu detalhamento por linha')),
  2, 'correção válida avança a revisão para 2'
);
select is(
  (financeiro.sso_corrigir_modo_proposta('18250000-0000-4000-8000-0000000000e1', '18250000-0000-4000-8000-00000000000a',
    '18250000-0000-4000-8000-00000000004a', 1, 'linhas', 'Cliente pediu detalhamento por linha')),
  2, 'replay do mesmo requestId devolve a mesma revisão'
);
select throws_ok(
  format($f$ select financeiro.sso_corrigir_modo_proposta(%L,%L,%L,1,'integral','Cliente pediu detalhamento por linha') $f$,
    '18250000-0000-4000-8000-0000000000e1', '18250000-0000-4000-8000-00000000000a', '18250000-0000-4000-8000-00000000004a'),
  '23505', 'request_id_conflitante', 'mesmo requestId com modo diferente é recusado'
);

reset role;
set local request.jwt.claims = '{"sub":"18250000-0000-4000-8000-000000000002","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;
select throws_ok(
  format($f$ select financeiro.sso_corrigir_modo_proposta(gen_random_uuid(),%L,%L,2,'integral','Sem concessão') $f$,
    '18250000-0000-4000-8000-00000000000a', '18250000-0000-4000-8000-00000000004a'),
  '42501', 'sem_acesso_ou_dados_invalidos', 'usuário sem a concessão faturavel.efetivar não corrige modo'
);

select * from finish();
rollback;
