-- E01-S182 (Faturáveis por origem) — modo de faturamento da proposta operacional.
-- `financeiro.sso_definir_modo_proposta` decide se a proposta aceita vira UM faturável integral
-- ou faturáveis por linha de material. Não tinha cobertura.
--
-- A regra que mais importa, e a razão de a função existir: o modo não pode ser escolhido depois
-- que a origem já gerou faturável. Trocar o modo nesse ponto duplicaria ou perderia receita, e a
-- função recusa com `origem_ja_faturavel_requer_reconciliacao` em vez de decidir sozinha.
begin;
select plan(10);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('18240000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's182-modo@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('18240000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 's182-modo-sem@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('18240000-0000-4000-8000-000000000001', 'superadmin', 'S182 Modo', true),
 ('18240000-0000-4000-8000-000000000002', 'colaborador', 'S182 Modo Sem Concessão', true);
insert into pcm.clientes (id, nome, ativo, created_by) values
 ('18240000-0000-4000-8000-00000000000a', 'Cliente S182 Modo', true, '18240000-0000-4000-8000-000000000001');
insert into config.sso_concessoes (usuario_id, acao, cliente_id) values
 ('18240000-0000-4000-8000-000000000001', 'faturavel.efetivar', '18240000-0000-4000-8000-00000000000a');

insert into pcm.chamados (id, numero, cliente_id, titulo, created_by) values
 ('18240000-0000-4000-8000-00000000001a', 'CH-S182-MODO', '18240000-0000-4000-8000-00000000000a', 'Chamado da proposta', '18240000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico (id, client_id, chamado_id, numero, titulo, categoria, status, updated_at, created_by) values
 ('18240000-0000-4000-8000-00000000002a', '18240000-0000-4000-8000-00000000000a', '18240000-0000-4000-8000-00000000001a', 'OS-S182-MODO', 'OS da proposta', 'corretiva', 'em_execucao', now(), '18240000-0000-4000-8000-000000000001');
insert into pcm.listas_materiais (id, cliente_id, ordem_servico_id, responsavel, texto_original, estado, revisao, criado_por) values
 ('18240000-0000-4000-8000-00000000003a', '18240000-0000-4000-8000-00000000000a', '18240000-0000-4000-8000-00000000002a', 'sinergica', 'Disjuntor e cabo', 'levantada', 1, '18240000-0000-4000-8000-000000000001');

-- Proposta sem oportunidade exige o gate de origem operacional aberto (trigger
-- comercial.sso_proteger_origem_operacional).
update comercial.sso_origem_operacional_gate set habilitado = true where id;

-- Proposta A: aceita, ainda sem faturável. Proposta B: aceita, já com faturável gerado.
insert into comercial.propostas (id, tipo, status, preco_centavos, created_by) values
 ('18240000-0000-4000-8000-00000000004a', 'simples', 'aceita', 500000, '18240000-0000-4000-8000-000000000001'),
 ('18240000-0000-4000-8000-00000000004b', 'simples', 'aceita', 700000, '18240000-0000-4000-8000-000000000001'),
 -- Proposta ainda em rascunho: só proposta aceita define modo.
 ('18240000-0000-4000-8000-00000000004c', 'simples', 'rascunho', 300000, '18240000-0000-4000-8000-000000000001');
insert into comercial.proposta_origens_operacionais (proposta_id, ordem_servico_id, lista_materiais_id, criado_por) values
 ('18240000-0000-4000-8000-00000000004a', '18240000-0000-4000-8000-00000000002a', '18240000-0000-4000-8000-00000000003a', '18240000-0000-4000-8000-000000000001'),
 ('18240000-0000-4000-8000-00000000004b', '18240000-0000-4000-8000-00000000002a', '18240000-0000-4000-8000-00000000003a', '18240000-0000-4000-8000-000000000001'),
 ('18240000-0000-4000-8000-00000000004c', '18240000-0000-4000-8000-00000000002a', '18240000-0000-4000-8000-00000000003a', '18240000-0000-4000-8000-000000000001');

-- A proposta B já virou faturável: o modo dela não pode mais ser escolhido sem reconciliação.
insert into financeiro.itens_faturaveis (id, cliente_id, origem_tipo, origem_id, valor_original_centavos, competencia) values
 ('18240000-0000-4000-8000-00000000005b', '18240000-0000-4000-8000-00000000000a', 'proposta_operacional', '18240000-0000-4000-8000-00000000004b', 700000, date '2026-11-01');

set local request.jwt.claims = '{"sub":"18240000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select financeiro.sso_definir_modo_proposta(gen_random_uuid(),%L,%L,'integral','Definição inicial') $f$,
    '18240000-0000-4000-8000-00000000000a', '18240000-0000-4000-8000-00000000004a'),
  '55000', 'indisponivel', 'gate de modo de faturamento fechado por padrão recusa'
);

reset role;
update financeiro.sso_modo_faturamento_gate set habilitado = true where id;
set local request.jwt.claims = '{"sub":"18240000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select throws_ok(
  format($f$ select financeiro.sso_definir_modo_proposta(gen_random_uuid(),%L,%L,'hibrido','Modo inventado') $f$,
    '18240000-0000-4000-8000-00000000000a', '18240000-0000-4000-8000-00000000004a'),
  '42501', 'sem_acesso_ou_dados_invalidos', 'modo fora de integral/linhas é recusado'
);
select throws_ok(
  format($f$ select financeiro.sso_definir_modo_proposta(gen_random_uuid(),%L,%L,'integral','   ') $f$,
    '18240000-0000-4000-8000-00000000000a', '18240000-0000-4000-8000-00000000004a'),
  '42501', 'sem_acesso_ou_dados_invalidos', 'motivo em branco é recusado'
);
select throws_ok(
  format($f$ select financeiro.sso_definir_modo_proposta(gen_random_uuid(),%L,gen_random_uuid(),'integral','Proposta inexistente') $f$,
    '18240000-0000-4000-8000-00000000000a'),
  '42501', 'origem_nao_encontrada_ou_sem_acesso', 'proposta inexistente é recusada'
);
select throws_ok(
  format($f$ select financeiro.sso_definir_modo_proposta(gen_random_uuid(),%L,%L,'integral','Proposta em rascunho') $f$,
    '18240000-0000-4000-8000-00000000000a', '18240000-0000-4000-8000-00000000004c'),
  '42501', 'origem_nao_encontrada_ou_sem_acesso', 'proposta que não está aceita não define modo'
);

-- A regra central: origem que já virou faturável exige reconciliação, não troca de modo.
select throws_ok(
  format($f$ select financeiro.sso_definir_modo_proposta(gen_random_uuid(),%L,%L,'linhas','Mudando depois do faturável') $f$,
    '18240000-0000-4000-8000-00000000000a', '18240000-0000-4000-8000-00000000004b'),
  '23514', 'origem_ja_faturavel_requer_reconciliacao', 'proposta que já gerou faturável não troca de modo em silêncio'
);

select is(
  (financeiro.sso_definir_modo_proposta('18240000-0000-4000-8000-0000000000e1', '18240000-0000-4000-8000-00000000000a',
    '18240000-0000-4000-8000-00000000004a', 'integral', 'Faturar a proposta inteira'))::text,
  '18240000-0000-4000-8000-00000000004a'::text, 'modo é definido para proposta aceita ainda sem faturável'
);
select is(
  (financeiro.sso_definir_modo_proposta('18240000-0000-4000-8000-0000000000e1', '18240000-0000-4000-8000-00000000000a',
    '18240000-0000-4000-8000-00000000004a', 'integral', 'Faturar a proposta inteira'))::text,
  '18240000-0000-4000-8000-00000000004a'::text, 'replay do mesmo requestId devolve o mesmo resultado'
);
select throws_ok(
  format($f$ select financeiro.sso_definir_modo_proposta(%L,%L,%L,'linhas','Faturar a proposta inteira') $f$,
    '18240000-0000-4000-8000-0000000000e1', '18240000-0000-4000-8000-00000000000a', '18240000-0000-4000-8000-00000000004a'),
  '23505', 'request_id_conflitante', 'mesmo requestId com modo diferente é recusado'
);

reset role;
set local request.jwt.claims = '{"sub":"18240000-0000-4000-8000-000000000002","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;
select throws_ok(
  format($f$ select financeiro.sso_definir_modo_proposta(gen_random_uuid(),%L,%L,'integral','Sem concessão') $f$,
    '18240000-0000-4000-8000-00000000000a', '18240000-0000-4000-8000-00000000004a'),
  '42501', 'sem_acesso_ou_dados_invalidos', 'usuário sem a concessão faturavel.efetivar não define modo'
);

select * from finish();
rollback;
