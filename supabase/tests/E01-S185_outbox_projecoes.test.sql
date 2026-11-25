-- E01-S185 AC-1 (identificar objeto, causa e impacto) e AC-2 (estados fiéis, histórico,
-- minimização) — prova real das migrations 0384 (conferência da outbox + notas append-only) e
-- 0391/1562 (projeções de Comercial e Financeiro derivadas AO VIVO das tabelas reais, sem tabela
-- de "ocorrência" paralela).
--
-- O que esta prova cobre, por desenho:
--   • gate fechado recusa (55000) — e os gates são FECHADOS aqui de propósito, porque a migration
--     1875 abre todos eles; sem fechar antes, a prova do caminho negado viraria falso verde;
--   • permissão ausente recusa (42501), incluindo isolamento por Cliente (operador do Cliente A
--     nunca vê objeto do Cliente B, nem na listagem nem na anotação);
--   • paginação inválida recusa (22023);
--   • concorrência otimista contra o estado real da outbox (40001 origem_alterada) — a anotação
--     nunca confia no payload do operador;
--   • idempotência por request_id (replay devolve o mesmo resultado; payload diferente → 23505);
--   • append-only (nota nunca é editada → 23514 nota_imutavel).
-- Fixtures sintéticas; executar apenas em banco descartável, sem efeito externo.
begin;
select plan(30);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('18750000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s185-outbox@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('18750000-0000-4000-8000-000000000001','superadmin','S185 Outbox',true);
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('18750000-0000-4000-8000-00000000000a','Cliente A S185',true,'18750000-0000-4000-8000-000000000001'),
 ('18750000-0000-4000-8000-00000000000b','Cliente B S185',true,'18750000-0000-4000-8000-000000000001');
-- Concessões só no Cliente A: o Cliente B é o controle negativo do isolamento.
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('18750000-0000-4000-8000-000000000001','integracao.reconciliar','18750000-0000-4000-8000-00000000000a'),
 ('18750000-0000-4000-8000-000000000001','material.gerir','18750000-0000-4000-8000-00000000000a'),
 ('18750000-0000-4000-8000-000000000001','faturavel.efetivar','18750000-0000-4000-8000-00000000000a'),
 ('18750000-0000-4000-8000-000000000001','despesa_visita.gerir','18750000-0000-4000-8000-00000000000a');

insert into pcm.sistemas(id,cliente_id,nome) values
 ('18750000-0000-4000-8000-000000000021','18750000-0000-4000-8000-00000000000a','Sistema A S185'),
 ('18750000-0000-4000-8000-000000000022','18750000-0000-4000-8000-00000000000b','Sistema B S185');
-- A fixture acima pode ter enfileirado linhas pelas triggers de sync; a prova precisa de uma
-- outbox determinística.
delete from pcm.auvo_sync_outbox;
insert into pcm.auvo_sync_outbox(id,entity,row_id,op,status,attempts) values
 ('18750000-0000-4000-8000-000000000031','sistemas','18750000-0000-4000-8000-000000000021','update','pending',0),
 ('18750000-0000-4000-8000-000000000032','sistemas','18750000-0000-4000-8000-000000000022','update','error',3);

-- ───────────────────────── AC-1: conferência da outbox ─────────────────────
update pcm.reconciliacao_outbox_gate set habilitado=false where id;
set local request.jwt.claims = '{"sub":"18750000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok(
  $$ select * from pcm.sso_listar_outbox_reconciliacao('18750000-0000-4000-8000-00000000000a',null,10) $$,
  '55000','reconciliacao_bloqueada','gate de reconciliação fechado recusa a conferência da outbox');
reset role;
update pcm.reconciliacao_outbox_gate set habilitado=true where id;
set local role authenticated;

select throws_ok(
  $$ select * from pcm.sso_listar_outbox_reconciliacao('18750000-0000-4000-8000-00000000000b',null,10) $$,
  '42501','cliente_nao_encontrado_ou_sem_acesso','Cliente sem concessão não lista a própria fila');
select throws_ok(
  $$ select * from pcm.sso_listar_outbox_reconciliacao('18750000-0000-4000-8000-00000000000a',null,0) $$,
  '22023','paginacao_invalida','limite fora da faixa é recusado');
select is(
  (select count(*)::int from pcm.sso_listar_outbox_reconciliacao('18750000-0000-4000-8000-00000000000a',null,10)),
  1,'listagem do Cliente A traz exatamente o item do Cliente A');
select is(
  (select estado from pcm.sso_listar_outbox_reconciliacao('18750000-0000-4000-8000-00000000000a',null,10) limit 1),
  'pendente','status técnico da outbox é traduzido para o vocabulário de reconciliação');
select is(
  (select count(*)::int from pcm.sso_listar_outbox_reconciliacao('18750000-0000-4000-8000-00000000000a',null,10)
    where id='18750000-0000-4000-8000-000000000032'),
  0,'item de outro Cliente nunca aparece na fila do Cliente A (isolamento)');

-- A variante filtrada tinha o MESMO defeito de "id" ambíguo (42702) corrigido pela migration
-- 1874; sem estas duas linhas o caminho continuaria sem execução nenhuma.
select is(
  (select count(*)::int from pcm.sso_listar_outbox_reconciliacao_filtrada('18750000-0000-4000-8000-00000000000a','pending',null,10)),
  1,'filtro por estado da fonte devolve o item pendente do Cliente A');
select throws_ok(
  $$ select * from pcm.sso_listar_outbox_reconciliacao_filtrada('18750000-0000-4000-8000-00000000000a','inexistente',null,10) $$,
  '22023','filtro_invalido','estado de fonte fora do domínio é recusado');

-- ───────────────────────── AC-2: nota append-only com concorrência otimista ─
reset role;
update pcm.reconciliacao_outbox_gate set habilitado=false where id;
set local role authenticated;
select throws_ok(
  $$ select pcm.sso_anotar_outbox_reconciliacao('18750000-0000-4000-8000-000000000041','18750000-0000-4000-8000-00000000000a','18750000-0000-4000-8000-000000000031','pending',0,'Conferido') $$,
  '55000','reconciliacao_bloqueada','gate fechado recusa a anotação');
reset role;
update pcm.reconciliacao_outbox_gate set habilitado=true where id;
set local role authenticated;

select throws_ok(
  $$ select pcm.sso_anotar_outbox_reconciliacao('18750000-0000-4000-8000-000000000041','18750000-0000-4000-8000-00000000000a','18750000-0000-4000-8000-000000000031','pending',7,'Conferido') $$,
  '40001','origem_alterada','tentativas divergentes do estado real da outbox são recusadas');
select throws_ok(
  $$ select pcm.sso_anotar_outbox_reconciliacao('18750000-0000-4000-8000-000000000041','18750000-0000-4000-8000-00000000000a','18750000-0000-4000-8000-000000000032','error',3,'Conferido') $$,
  '42501','objeto_nao_encontrado_ou_sem_acesso','anotar item de outro Cliente é recusado (isolamento)');
select throws_ok(
  $$ select pcm.sso_anotar_outbox_reconciliacao('18750000-0000-4000-8000-000000000041','18750000-0000-4000-8000-00000000000a','18750000-0000-4000-8000-000000000031','pending',0,'   ') $$,
  '22023','anotacao_invalida','observação vazia é recusada');

select is(
  (pcm.sso_anotar_outbox_reconciliacao('18750000-0000-4000-8000-000000000041','18750000-0000-4000-8000-00000000000a','18750000-0000-4000-8000-000000000031','pending',0,'Conferido com o Auvo'))->>'outboxId',
  '18750000-0000-4000-8000-000000000031','anotação válida é registrada');
select is(
  (pcm.sso_anotar_outbox_reconciliacao('18750000-0000-4000-8000-000000000041','18750000-0000-4000-8000-00000000000a','18750000-0000-4000-8000-000000000031','pending',0,'Conferido com o Auvo'))->>'requestId',
  '18750000-0000-4000-8000-000000000041','replay do mesmo requestId devolve o mesmo resultado, sem duplicar');
select throws_ok(
  $$ select pcm.sso_anotar_outbox_reconciliacao('18750000-0000-4000-8000-000000000041','18750000-0000-4000-8000-00000000000a','18750000-0000-4000-8000-000000000031','pending',0,'Outra observação') $$,
  '23505','request_id_conflitante','mesmo requestId com payload diferente é recusado');

select is(
  (select count(*)::int from pcm.sso_listar_notas_outbox('18750000-0000-4000-8000-00000000000a','18750000-0000-4000-8000-000000000031',null,null,10)),
  1,'histórico da nota é legível pelo operador do Cliente certo');
select throws_ok(
  $$ select * from pcm.sso_listar_notas_outbox('18750000-0000-4000-8000-00000000000a','18750000-0000-4000-8000-000000000031',now(),null,10) $$,
  '22023','paginacao_invalida','cursor incompleto (sem o id de desempate) é recusado');
select throws_ok(
  $$ select * from pcm.sso_listar_notas_outbox('18750000-0000-4000-8000-00000000000b','18750000-0000-4000-8000-000000000032',null,null,10) $$,
  '42501','objeto_nao_encontrado_ou_sem_acesso','histórico de item de outro Cliente é recusado');

reset role;
select is((select count(*)::int from pcm.reconciliacao_outbox_notas where outbox_id='18750000-0000-4000-8000-000000000031'),
  1,'replay não insere segunda nota');
select throws_ok(
  $$ update pcm.reconciliacao_outbox_notas set observacao='editada' where true $$,
  '23514','nota_imutavel','nota de reconciliação é append-only, nunca editada');
select throws_ok(
  $$ delete from pcm.reconciliacao_outbox_notas where true $$,
  '23514','nota_imutavel','nota de reconciliação nunca é apagada');

-- ───────── AC-1/AC-2: projeções de Comercial e Financeiro (0391 via 1562) ───
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,created_by) values
 ('18750000-0000-4000-8000-000000000051','18750000-0000-4000-8000-00000000000a','OS-S185-1875','OS da projeção','corretiva','18750000-0000-4000-8000-000000000001');
insert into pcm.listas_materiais(id,cliente_id,ordem_servico_id,responsavel,texto_original,criado_por) values
 ('18750000-0000-4000-8000-000000000052','18750000-0000-4000-8000-00000000000a','18750000-0000-4000-8000-000000000051','sinergica','Material da projeção','18750000-0000-4000-8000-000000000001');
-- Proposta de origem operacional (sem Oportunidade) exige a trava de E01-S181 aberta — ela não
-- faz parte do destrave desta story, então a fixture abre só dentro da transação, como o teste de
-- E01-S181 faz.
update comercial.sso_origem_operacional_gate set habilitado=true where id;
insert into comercial.propostas(id,oportunidade_id,tipo,status,versao_atual,preco_centavos,piso_centavos) values
 ('18750000-0000-4000-8000-000000000053',null,'simples','enviada',1,15000,10000);
insert into comercial.proposta_origens_operacionais(proposta_id,ordem_servico_id,lista_materiais_id,criado_por) values
 ('18750000-0000-4000-8000-000000000053','18750000-0000-4000-8000-000000000051','18750000-0000-4000-8000-000000000052','18750000-0000-4000-8000-000000000001');

insert into pcm.visitas(id,cliente_id,inicio_em,fim_em,fuso,natureza,created_by) values
 ('18750000-0000-4000-8000-000000000061','18750000-0000-4000-8000-00000000000a','2026-11-01 11:00+00','2026-11-01 13:00+00','America/Sao_Paulo','regular','18750000-0000-4000-8000-000000000001');
insert into pcm.despesa_tipos(id,auvo_id,nome) values ('18750000-0000-4000-8000-000000000062',-1875001,'Categoria sintética S185');
insert into pcm.despesas_visita(id,visita_id,cliente_id,categoria_id,data,descricao,previsto_centavos,realizado_centavos,revisao,created_by) values
 ('18750000-0000-4000-8000-000000000063','18750000-0000-4000-8000-000000000061','18750000-0000-4000-8000-00000000000a','18750000-0000-4000-8000-000000000062','2026-11-01','Despesa fiel',10000,10000,1,'18750000-0000-4000-8000-000000000001'),
 ('18750000-0000-4000-8000-000000000064','18750000-0000-4000-8000-000000000061','18750000-0000-4000-8000-00000000000a','18750000-0000-4000-8000-000000000062','2026-11-02','Despesa alterada depois',20000,20000,3,'18750000-0000-4000-8000-000000000001');
insert into financeiro.itens_faturaveis(id,cliente_id,origem_tipo,origem_id,valor_original_centavos,competencia,status,revisao) values
 ('18750000-0000-4000-8000-000000000065','18750000-0000-4000-8000-00000000000a','despesa_visita','18750000-0000-4000-8000-000000000063',10000,'2026-11-01','pendente',1),
 ('18750000-0000-4000-8000-000000000066','18750000-0000-4000-8000-00000000000a','despesa_visita','18750000-0000-4000-8000-000000000064',20000,'2026-11-01','pendente',1);
-- A declaração guarda a revisão da despesa no momento do repasse; a despesa 064 mudou depois.
insert into financeiro.sso_declaracoes_repasse_despesa(item_id,despesa_id,despesa_revisao,visita_id,valor_centavos,regra_contratual,justificativa,ator_id,request_id) values
 ('18750000-0000-4000-8000-000000000065','18750000-0000-4000-8000-000000000063',1,'18750000-0000-4000-8000-000000000061',10000,'Repasse integral','Despesa fiel','18750000-0000-4000-8000-000000000001','18750000-0000-4000-8000-000000000071'),
 ('18750000-0000-4000-8000-000000000066','18750000-0000-4000-8000-000000000064',1,'18750000-0000-4000-8000-000000000061',20000,'Repasse integral','Despesa alterada','18750000-0000-4000-8000-000000000001','18750000-0000-4000-8000-000000000072');

update pcm.sso_origens_internas_mediadas_gate set habilitado=false where id;
set local role authenticated;
select throws_ok(
  $$ select * from pcm.sso_reconciliacao_comercial_mediada('18750000-0000-4000-8000-000000000001','18750000-0000-4000-8000-00000000000a',null,10) $$,
  '55000','consulta_desabilitada','gate da projeção mediada fechado recusa a consulta de Comercial');
reset role;
update pcm.sso_origens_internas_mediadas_gate set habilitado=true where id;
set local role authenticated;

select throws_ok(
  $$ select * from pcm.sso_reconciliacao_comercial_mediada('18750000-0000-4000-8000-00000000000a','18750000-0000-4000-8000-00000000000a',null,10) $$,
  '22023','parametros_invalidos','ator declarado diferente do autenticado é recusado');
select throws_ok(
  $$ select * from pcm.sso_reconciliacao_comercial_mediada('18750000-0000-4000-8000-000000000001','18750000-0000-4000-8000-00000000000b',null,10) $$,
  '42501','sem_acesso','projeção de Comercial de outro Cliente é recusada (isolamento)');
select is(
  (select classificacao from pcm.sso_reconciliacao_comercial_mediada('18750000-0000-4000-8000-000000000001','18750000-0000-4000-8000-00000000000a',null,10)
    where proposta_id='18750000-0000-4000-8000-000000000053'),
  'vinculo_observado','proposta com origem operacional coerente é classificada como vínculo observado');

select throws_ok(
  $$ select * from pcm.sso_reconciliacao_financeiro_mediada('18750000-0000-4000-8000-000000000001','18750000-0000-4000-8000-00000000000b',null,10) $$,
  '42501','sem_acesso','projeção de Financeiro de outro Cliente é recusada (isolamento)');
select is(
  (select classificacao from pcm.sso_reconciliacao_financeiro_mediada('18750000-0000-4000-8000-000000000001','18750000-0000-4000-8000-00000000000a',null,10)
    where item_id='18750000-0000-4000-8000-000000000065'),
  'vinculo_observado','faturável cuja despesa não mudou desde o repasse é vínculo observado');
select is(
  (select classificacao from pcm.sso_reconciliacao_financeiro_mediada('18750000-0000-4000-8000-000000000001','18750000-0000-4000-8000-00000000000a',null,10)
    where item_id='18750000-0000-4000-8000-000000000066'),
  'despesa_alterada_conferir','despesa alterada depois do repasse é sinalizada, não corrigida sozinha');
select is(
  (select despesa_revisao_atual from pcm.sso_reconciliacao_financeiro_mediada('18750000-0000-4000-8000-000000000001','18750000-0000-4000-8000-00000000000a',null,10)
    where item_id='18750000-0000-4000-8000-000000000066'),
  3,'a projeção mostra a revisão real da despesa, não uma cópia guardada');

reset role;
select is((select count(*)::int from pcm.reconciliacao_outbox_notas),1,'nenhuma consulta de projeção escreveu nota');

select * from finish();
rollback;
