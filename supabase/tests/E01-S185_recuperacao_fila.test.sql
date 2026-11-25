-- E01-S185 AC-3 (recuperar sem repetir efeito) e AC-4 (incerteza e múltiplos candidatos) —
-- prova real das migrations 1453/1454/1457 (solicitação de recuperação, histórico e recibo) e
-- 0710 (inbox de OS em situação incerta).
--
-- A regra que esta prova protege: solicitar recuperação REGISTRA INTENÇÃO LOCAL e nada mais —
-- não reenfileira, não muda o status da fila, não afirma efeito remoto. O recibo existe
-- justamente para o operador reler o resultado sem repetir o comando.
-- Gates são fechados explicitamente onde o caminho negado é provado, porque a migration 1875 os
-- abre. Fixtures sintéticas; executar apenas em banco descartável, sem efeito externo.
begin;
select plan(23);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('18740000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s185-recuperacao@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('18740000-0000-4000-8000-000000000001','superadmin','S185 Recuperação',true);
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('18740000-0000-4000-8000-00000000000a','Cliente A S185 recuperação',true,'18740000-0000-4000-8000-000000000001'),
 ('18740000-0000-4000-8000-00000000000b','Cliente B S185 recuperação',true,'18740000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('18740000-0000-4000-8000-000000000001','integracao.reconciliar','18740000-0000-4000-8000-00000000000a');
insert into pcm.sistemas(id,cliente_id,nome) values
 ('18740000-0000-4000-8000-000000000021','18740000-0000-4000-8000-00000000000a','Sistema A S185 recuperação');
delete from pcm.auvo_sync_outbox;
insert into pcm.auvo_sync_outbox(id,entity,row_id,op,status,attempts) values
 ('18740000-0000-4000-8000-000000000031','sistemas','18740000-0000-4000-8000-000000000021','update','error',2);

-- A prévia roda com a identidade do operador (auth.uid()), por isso as claims vêm antes dela.
-- A época é renovada por trigger a cada abertura/fechamento do gate de revisão: ler a época
-- corrente é parte do contrato de concorrência otimista, não um detalhe do teste.
set local request.jwt.claims = '{"sub":"18740000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
select (select epoca from pcm.reconciliacao_revisao_fila_gate where id) as epoca \gset
select (pcm.sso_previa_revisao_fila('18740000-0000-4000-8000-00000000000a','18740000-0000-4000-8000-000000000031'))->>'revisao' as revisao \gset

-- ───────────── AC-3: recuperar sem repetir efeito ──────────────────────────
update pcm.sso_solicitacao_recuperacao_gate set habilitado=false where id;
set local role authenticated;
select throws_ok(
  format($f$ select pcm.sso_solicitar_recuperacao_fila(%L,%L,%L,gen_random_uuid(),%L,%L,'Sem retorno do Auvo') $f$,
    '18740000-0000-4000-8000-000000000001','18740000-0000-4000-8000-00000000000a','18740000-0000-4000-8000-000000000031',:'epoca',:'revisao'),
  '55000','solicitacao_desabilitada','gate de solicitação fechado recusa o pedido de recuperação');
reset role;
update pcm.sso_solicitacao_recuperacao_gate set habilitado=true where id;
set local role authenticated;

select throws_ok(
  format($f$ select pcm.sso_solicitar_recuperacao_fila(%L,%L,%L,gen_random_uuid(),%L,%L,'Sem retorno do Auvo') $f$,
    '18740000-0000-4000-8000-00000000000a','18740000-0000-4000-8000-00000000000a','18740000-0000-4000-8000-000000000031',:'epoca',:'revisao'),
  '22023','parametros_invalidos','ator declarado diferente do autenticado é recusado');
select throws_ok(
  format($f$ select pcm.sso_solicitar_recuperacao_fila(%L,%L,%L,gen_random_uuid(),gen_random_uuid(),%L,'Sem retorno do Auvo') $f$,
    '18740000-0000-4000-8000-000000000001','18740000-0000-4000-8000-00000000000a','18740000-0000-4000-8000-000000000031',:'revisao'),
  '40001','epoca_indisponivel','época diferente da corrente invalida a prévia e recusa o pedido');
select throws_ok(
  format($f$ select pcm.sso_solicitar_recuperacao_fila(%L,%L,%L,gen_random_uuid(),%L,%L,'Sem retorno do Auvo') $f$,
    '18740000-0000-4000-8000-000000000001','18740000-0000-4000-8000-00000000000b','18740000-0000-4000-8000-000000000031',:'epoca',:'revisao'),
  '42501','sem_acesso','Cliente sem concessão não solicita recuperação (isolamento)');
select throws_ok(
  format($f$ select pcm.sso_solicitar_recuperacao_fila(%L,%L,%L,gen_random_uuid(),%L,'999999','Sem retorno do Auvo') $f$,
    '18740000-0000-4000-8000-000000000001','18740000-0000-4000-8000-00000000000a','18740000-0000-4000-8000-000000000031',:'epoca'),
  '40001','revisao_obsoleta','revisão divergente da fila real é recusada (concorrência otimista)');
select throws_ok(
  format($f$ select pcm.sso_solicitar_recuperacao_fila(%L,%L,%L,gen_random_uuid(),%L,%L,'   ') $f$,
    '18740000-0000-4000-8000-000000000001','18740000-0000-4000-8000-00000000000a','18740000-0000-4000-8000-000000000031',:'epoca',:'revisao'),
  '22023','parametros_invalidos','motivo vazio é recusado: a intenção precisa ser rastreável');

select (pcm.sso_solicitar_recuperacao_fila('18740000-0000-4000-8000-000000000001','18740000-0000-4000-8000-00000000000a',
  '18740000-0000-4000-8000-000000000031','18740000-0000-4000-8000-000000000041',:'epoca'::uuid,:'revisao','Sem retorno do Auvo')) as pedido \gset
select is(:'pedido'::jsonb->>'solicitacaoRegistrada','true','solicitação válida é registrada');
select is(:'pedido'::jsonb->>'retryExecutado','false','solicitar recuperação NÃO executa retry');
select is(:'pedido'::jsonb->>'efeitoRemotoComprovado','false','solicitar recuperação NÃO afirma efeito remoto');
select is(
  (pcm.sso_solicitar_recuperacao_fila('18740000-0000-4000-8000-000000000001','18740000-0000-4000-8000-00000000000a',
    '18740000-0000-4000-8000-000000000031','18740000-0000-4000-8000-000000000041',:'epoca'::uuid,:'revisao','Sem retorno do Auvo'))::text,
  :'pedido','replay do mesmo requestId devolve o mesmo resultado, sem reprocessar');
select throws_ok(
  format($f$ select pcm.sso_solicitar_recuperacao_fila(%L,%L,%L,%L,%L,%L,'Outro motivo') $f$,
    '18740000-0000-4000-8000-000000000001','18740000-0000-4000-8000-00000000000a','18740000-0000-4000-8000-000000000031',
    '18740000-0000-4000-8000-000000000041',:'epoca',:'revisao'),
  '23505','request_id_conflitante','mesmo requestId com payload diferente é recusado');

select is(
  (select count(*)::int from pcm.sso_listar_solicitacoes_recuperacao('18740000-0000-4000-8000-000000000001',
    '18740000-0000-4000-8000-00000000000a','18740000-0000-4000-8000-000000000031',null,10)),
  1,'histórico mostra a solicitação registrada uma única vez');
select throws_ok(
  format($f$ select * from pcm.sso_listar_solicitacoes_recuperacao(%L,%L,%L,null,10) $f$,
    '18740000-0000-4000-8000-000000000001','18740000-0000-4000-8000-00000000000b','18740000-0000-4000-8000-000000000031'),
  '42501','sem_acesso','histórico de outro Cliente é recusado (isolamento)');

select is(
  (pcm.sso_recibo_solicitacao_recuperacao('18740000-0000-4000-8000-000000000001','18740000-0000-4000-8000-00000000000a',
    '18740000-0000-4000-8000-000000000031','18740000-0000-4000-8000-000000000041',:'epoca'::uuid,:'revisao','Sem retorno do Auvo'))::text,
  :'pedido','recibo devolve o resultado original sem repetir o comando');
select ok(
  (pcm.sso_recibo_solicitacao_recuperacao('18740000-0000-4000-8000-000000000001','18740000-0000-4000-8000-00000000000a',
    '18740000-0000-4000-8000-000000000031','18740000-0000-4000-8000-000000000049',:'epoca'::uuid,:'revisao','Sem retorno do Auvo')) is null,
  'recibo de requestId inexistente devolve nulo, não inventa resultado');
select throws_ok(
  format($f$ select pcm.sso_recibo_solicitacao_recuperacao(%L,%L,%L,%L,%L,%L,'Motivo divergente') $f$,
    '18740000-0000-4000-8000-000000000001','18740000-0000-4000-8000-00000000000a','18740000-0000-4000-8000-000000000031',
    '18740000-0000-4000-8000-000000000041',:'epoca',:'revisao'),
  '42501','sem_acesso_ou_tentativa_divergente','recibo com payload divergente do registrado é recusado');

reset role;
select is((select status from pcm.auvo_sync_outbox where id='18740000-0000-4000-8000-000000000031'),
  'error','a fila do Auvo continua intacta: nenhum reenfileiramento');
select is((select attempts from pcm.auvo_sync_outbox where id='18740000-0000-4000-8000-000000000031'),
  2,'nenhuma tentativa nova foi consumida');
select throws_ok(
  $$ update pcm.sso_solicitacoes_recuperacao set motivo='editado' where true $$,
  '23514','conferencia_imutavel','solicitação de recuperação é append-only, nunca editada');

-- ───────────── AC-4: inbox de OS em situação incerta ───────────────────────
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,auvo_task_id,auvo_sync_status,created_by) values
 ('18740000-0000-4000-8000-000000000051','18740000-0000-4000-8000-00000000000a','OS-S185-1874-A','OS incerta A','corretiva',1874001,'erro','18740000-0000-4000-8000-000000000001'),
 ('18740000-0000-4000-8000-000000000052','18740000-0000-4000-8000-00000000000b','OS-S185-1874-B','OS incerta B','corretiva',1874002,'erro','18740000-0000-4000-8000-000000000001');
update pcm.reconciliacao_os_evidencia_gate set habilitado=false where id;
set local role authenticated;
select throws_ok(
  $$ select * from pcm.sso_inbox_os_situacao_incerta('18740000-0000-4000-8000-00000000000a',null,10) $$,
  '55000','indisponivel','gate de evidência de OS fechado recusa o inbox de situação incerta');
reset role;
update pcm.reconciliacao_os_evidencia_gate set habilitado=true where id;
set local role authenticated;
select throws_ok(
  $$ select * from pcm.sso_inbox_os_situacao_incerta('18740000-0000-4000-8000-00000000000b',null,10) $$,
  '42501','sem_acesso','inbox de OS de outro Cliente é recusado (isolamento)');
select is(
  (select count(*)::int from pcm.sso_inbox_os_situacao_incerta('18740000-0000-4000-8000-00000000000a',null,10)),
  1,'inbox traz só a OS incerta do Cliente autorizado');
select is(
  (select declaracao from pcm.sso_inbox_os_situacao_incerta('18740000-0000-4000-8000-00000000000a',null,10) limit 1),
  null,'sem evidência manual declarada, o inbox não inventa resultado');

select * from finish();
rollback;
