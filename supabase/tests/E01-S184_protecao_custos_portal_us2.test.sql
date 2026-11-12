-- E01-S184 AC-3/AC-4: dados sintéticos, sem escrita externa.
-- Cenário: proposta P1 já "enviada" (histórica); correção usa o caminho real do domínio
-- (comercial.fn_duplicar_proposta, E03-S04/0184) para abrir P2, nunca reabre P1. Prova que
-- snapshot privado e decisões de P1 permanecem imutáveis, que a trilha da correção
-- (payload->>'duplicadaDe') fica só no privado, e que a projeção pública de cada proposta deriva
-- da SUA PRÓPRIA versão confirmada — nunca da composição ao vivo de outro objeto em edição.
begin;
select plan(20);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('18402000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sindico-s184us2@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('18402000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-s184us2@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into pcm.clientes (id, nome, ativo, created_by) values ('18402000-0000-0000-0000-000000000002', 'Conta S184 US2', true, '18402000-0000-0000-0000-000000000001');
insert into config.usuarios (user_id, papel, nome, ativo) values
 ('18402000-0000-0000-0000-000000000001', 'cliente-sindico', 'Síndico S184 US2', true),
 ('18402000-0000-0000-0000-000000000011', 'superadmin', 'Admin S184 US2', true);
insert into config.usuario_cliente (user_id, cliente_id) values ('18402000-0000-0000-0000-000000000001', '18402000-0000-0000-0000-000000000002');
insert into comercial.etapas_funil (id, nome, ordem, cor, tipo) values ('18402000-0000-0000-0000-000000000003', 'Etapa S184 US2', 91842, '#000000', 'aberta');
insert into comercial.oportunidades (id, cliente_id, etapa_id, titulo) values ('18402000-0000-0000-0000-000000000004', '18402000-0000-0000-0000-000000000002', '18402000-0000-0000-0000-000000000003', 'Teste S184 US2');

-- P1: proposta histórica já "enviada", com custo sentinela no snapshot privado da versão 1.
insert into comercial.propostas (id, oportunidade_id, tipo, status, custo_total_centavos, piso_centavos, preco_sugerido_centavos, preco_centavos, versao_atual)
values ('18402000-0000-0000-0000-000000000005', '18402000-0000-0000-0000-000000000004', 'simples', 'enviada', 500000, 100000, 140000, 150000, 1);
insert into comercial.proposta_itens (proposta_id, tipo, descricao, quantidade, custo_unitario_centavos, total_centavos)
values ('18402000-0000-0000-0000-000000000005', 'outro', 'Peça original', 2, 250000, 500000);
insert into comercial.proposta_versoes (proposta_id, versao, payload) values ('18402000-0000-0000-0000-000000000005', 1,
 '{"proposta":{"tipo":"simples","preco_centavos":150000,"custo_total_centavos":500000,"versao_atual":1},"itens":[{"descricao":"Peça original","quantidade":2,"custo_unitario_centavos":250000,"total_centavos":500000}]}');

set local role authenticated;
set local request.jwt.claims = '{"sub":"18402000-0000-0000-0000-000000000001","role":"authenticated","user_role":"cliente-sindico","cliente_id":"18402000-0000-0000-0000-000000000002"}';
select is((select payload #>> '{proposta,preco_centavos}' from comercial.portal_propostas where id = '18402000-0000-0000-0000-000000000005'), '150000', 'P1: preço de venda original visível antes de qualquer correção');
select ok((select payload::text not like '%250000%' and payload::text not like '%500000%' from comercial.portal_propostas where id = '18402000-0000-0000-0000-000000000005'), 'P1: custo original nunca aparece na projeção pública');

set local request.jwt.claims = '{"sub":"18402000-0000-0000-0000-000000000011","role":"authenticated","user_role":"superadmin"}';

-- Correção: duplica P1 (caminho real do domínio) em vez de reabrir/editar a proposta terminal.
-- Captura o id da cópia numa variável psql (\gset) — mesmo padrão já usado neste repositório
-- (ex.: E01-S178_incorporacao_revogacao_sequencial.test.sql) para referenciar depois sem
-- depender de outra leitura direta de comercial.propostas (bloqueada para o síndico).
select (comercial.fn_duplicar_proposta('18402000-0000-0000-0000-000000000005')).id::text as corrigida \gset
select is((select count(*)::int from comercial.propostas where oportunidade_id = '18402000-0000-0000-0000-000000000004'), 2, 'duplicar cria um novo agregado — passam a existir duas propostas na mesma oportunidade');
select is((select status from comercial.propostas where id = :'corrigida'), 'rascunho', 'cópia nasce rascunho — nunca herda status terminal de P1');
select is((select v.payload ->> 'duplicadaDe' from comercial.proposta_versoes v where v.proposta_id = :'corrigida' and v.versao = 1), '18402000-0000-0000-0000-000000000005', 'trilha da correção aponta para P1 no snapshot privado da cópia');

-- Tentativa de "corrigir" editando P1 diretamente (status terminal) é recusada — único caminho é a cópia.
select throws_ok($$ select comercial.fn_salvar_composicao_proposta('18402000-0000-0000-0000-000000000005', '[]'::jsonb, 0, 0, 0, 999, null, null, null) $$, '23514', null, 'editar P1 (enviada) diretamente continua bloqueado — AC-7 vale também para a correção');

-- Correção de fato: nova composição e novo preço de venda na CÓPIA, nunca em P1.
select lives_ok(format($f$ select comercial.fn_salvar_composicao_proposta(%L, '[{"tipo":"outro","descricao":"Peça corrigida","quantidade":2,"custo_unitario_centavos":260000,"total_centavos":520000}]'::jsonb, 520000, 100000, 160000, 175000, null, null, null) $f$, :'corrigida'), 'composição corrigida grava na cópia, não em P1');

update comercial.propostas set status = 'em_revisao' where id = :'corrigida';
update comercial.propostas set status = 'aprovada' where id = :'corrigida';
update comercial.propostas set status = 'enviada' where id = :'corrigida';
select is((select status from comercial.propostas where id = :'corrigida'), 'enviada', 'cópia corrigida percorre o mesmo fluxo de aprovação até ser reenviada');

set local request.jwt.claims = '{"sub":"18402000-0000-0000-0000-000000000001","role":"authenticated","user_role":"cliente-sindico","cliente_id":"18402000-0000-0000-0000-000000000002"}';
select is((select payload #>> '{proposta,preco_centavos}' from comercial.portal_propostas where id = :'corrigida'), '175000', 'cópia enviada: projeção pública mostra o preço CORRIGIDO');
select ok((select payload::text not like '%260000%' and payload::text not like '%520000%' from comercial.portal_propostas where id = :'corrigida'), 'cópia enviada: custo corrigido nunca aparece na projeção pública');
select ok((select payload::text not like '%duplicadaDe%' from comercial.portal_propostas where id = :'corrigida'), 'projeção pública da cópia não expõe a chave de trilha da correção');
select ok((select payload::text not like '%18402000-0000-0000-0000-000000000005%' from comercial.portal_propostas where id = :'corrigida'), 'projeção pública da cópia não expõe o id de P1 (trilha é só privada)');
select is((select payload #>> '{proposta,preco_centavos}' from comercial.portal_propostas where id = '18402000-0000-0000-0000-000000000005'), '150000', 'P1: projeção pública NÃO muda enquanto a cópia era editada/corrigida — não deriva de composição alheia');

set local request.jwt.claims = '{"sub":"18402000-0000-0000-0000-000000000011","role":"authenticated","user_role":"superadmin"}';
select is((select count(*)::int from comercial.proposta_versoes where proposta_id = '18402000-0000-0000-0000-000000000005'), 1, 'P1 continua com exatamente 1 versão — correção nunca grava em cima do histórico original');
select is((select v.payload #>> '{proposta,preco_centavos}' from comercial.proposta_versoes v where v.proposta_id = '18402000-0000-0000-0000-000000000005' and v.versao = 1), '150000', 'snapshot privado original de P1 continua byte-a-byte o mesmo');

-- Imutabilidade estrutural (AC-7/E03-S04): nem superadmin grava sobre proposta_versoes.
select throws_ok($$ update comercial.proposta_versoes set payload = '{}'::jsonb where proposta_id = '18402000-0000-0000-0000-000000000005' and versao = 1 $$, '42501', null, 'nenhum papel, nem superadmin, pode UPDATE em proposta_versoes');
select throws_ok($$ delete from comercial.proposta_versoes where proposta_id = '18402000-0000-0000-0000-000000000005' and versao = 1 $$, '42501', null, 'nenhum papel, nem superadmin, pode DELETE em proposta_versoes');

-- Sessão revogada: síndico desativado não decide nem lê nenhuma das duas propostas.
reset role;
update config.usuarios set ativo = false where user_id = '18402000-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"18402000-0000-0000-0000-000000000001","role":"authenticated","user_role":"cliente-sindico","cliente_id":"18402000-0000-0000-0000-000000000002"}';
select is((select count(*)::int from comercial.portal_propostas where id in ('18402000-0000-0000-0000-000000000005', :'corrigida')), 0, 'síndico desativado perde acesso às duas propostas (original e corrigida)');
select throws_ok($$ select comercial.portal_decidir_proposta('18402000-0000-0000-0000-000000000005', 'aceita', null) $$, '42501', null, 'sessão revogada não decide P1');
select throws_ok(format($f$ select comercial.portal_decidir_proposta(%L, 'aceita', null) $f$, :'corrigida'), '42501', null, 'sessão revogada não decide a cópia corrigida');

select * from finish();
rollback;
