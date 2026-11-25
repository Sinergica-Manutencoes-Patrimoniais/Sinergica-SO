-- E01-S185 AC-6 (varredura periódica, tentativa presa, fechamento rastreável) — prova real das
-- migrations 1205 (varredura local da fila), 1207 (progresso paginado com revisão esperada) e
-- 1416 (configuração do executor periódico).
--
-- Decisão que esta prova fixa: o gate pcm.sso_varredura_fila_gate continua FECHADO em produção
-- (ADR-1264, e a migration 1875 não o abre). O teste o abre dentro da transação, que faz rollback,
-- só para provar o comportamento — nenhuma varredura é ligada por este arquivo, e a configuração
-- do executor responde 'cronCriado': false mesmo no caminho feliz.
-- Fixtures sintéticas; executar apenas em banco descartável, sem efeito externo.
begin;
select plan(24);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('18750000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s185-varredura@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now()),
 ('18750000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s185-varredura-sup@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values
 ('18750000-0000-4000-8000-000000000001','superadmin','S185 Varredura',true),
 ('18750000-0000-4000-8000-000000000002','supervisor','S185 Supervisor',true);
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('18750000-0000-4000-8000-00000000000a','Cliente A S185 varredura',true,'18750000-0000-4000-8000-000000000001'),
 ('18750000-0000-4000-8000-00000000000b','Cliente B S185 varredura',true,'18750000-0000-4000-8000-000000000001');
insert into pcm.sistemas(id,cliente_id,nome) values
 ('18750000-0000-4000-8000-000000000021','18750000-0000-4000-8000-00000000000a','Sistema A S185 varredura'),
 ('18750000-0000-4000-8000-000000000022','18750000-0000-4000-8000-00000000000b','Sistema B S185 varredura');
delete from pcm.auvo_sync_outbox;
insert into pcm.auvo_sync_outbox(id,entity,row_id,op,status,attempts) values
 ('18750000-0000-4000-8000-000000000031','sistemas','18750000-0000-4000-8000-000000000021','update','pending',0),
 ('18750000-0000-4000-8000-000000000032','sistemas','18750000-0000-4000-8000-000000000022','update','error',4),
 -- Linha órfã: o objeto de origem não existe mais, então não há Cliente comprovável.
 ('18750000-0000-4000-8000-000000000033','sistemas','18750000-0000-4000-8000-0000000000ff','update','processing',1);

-- ─────────── AC-6: varredura local, só service_role, gate fechado por padrão ─
set local role service_role;
select throws_ok(
  $$ select pcm.sso_avancar_varredura_fila('18750000-0000-4000-8000-000000000041','18750000-0000-4000-8000-000000000051',0,50) $$,
  '55000','varredura_desabilitada','gate de varredura fechado (ADR-1264) recusa o avanço — estado padrão de produção');
reset role;
update pcm.sso_varredura_fila_gate set habilitado=true where id;
set local role service_role;

select throws_ok(
  $$ select pcm.sso_avancar_varredura_fila('18750000-0000-4000-8000-000000000041','18750000-0000-4000-8000-000000000051',3,50) $$,
  '40001','revisao_obsoleta','execução nova só começa na revisão 0: revisão esperada divergente é recusada');
select throws_ok(
  $$ select pcm.sso_avancar_varredura_fila('18750000-0000-4000-8000-000000000041','18750000-0000-4000-8000-000000000051',0,0) $$,
  '22023','parametros_invalidos','limite fora da faixa é recusado');

select (pcm.sso_avancar_varredura_fila('18750000-0000-4000-8000-000000000041','18750000-0000-4000-8000-000000000051',0,50)) as pagina \gset
select is(:'pagina'::jsonb->>'estado','concluida','página única cobre a fila inteira e fecha a execução');
select is(:'pagina'::jsonb->>'considerados','3','a varredura considera todas as linhas de fila elegíveis');
select is(:'pagina'::jsonb->>'alterados','2','só os itens com Cliente comprovável viram ocorrência');
select is(:'pagina'::jsonb->>'efeitoRemotoComprovado','false','varredura é local: nunca afirma efeito remoto');

select is(
  (pcm.sso_avancar_varredura_fila('18750000-0000-4000-8000-000000000041','18750000-0000-4000-8000-000000000051',0,50))::text,
  :'pagina','replay do mesmo requestId devolve o mesmo resultado, sem varrer de novo');
select throws_ok(
  $$ select pcm.sso_avancar_varredura_fila('18750000-0000-4000-8000-000000000041','18750000-0000-4000-8000-000000000051',0,25) $$,
  '23505','request_id_conflitante','mesmo requestId com limite diferente é recusado');
select throws_ok(
  $$ select pcm.sso_avancar_varredura_fila('18750000-0000-4000-8000-000000000041','18750000-0000-4000-8000-000000000052',0,50) $$,
  '40001','revisao_obsoleta','avanço com revisão velha é recusado (concorrência otimista da execução)');
select throws_ok(
  $$ select pcm.sso_avancar_varredura_fila('18750000-0000-4000-8000-000000000041','18750000-0000-4000-8000-000000000052',1,50) $$,
  '23514','execucao_concluida','execução já concluída não aceita novo avanço');

reset role;
select is((select cliente_id from pcm.sso_ocorrencias_fila where outbox_id='18750000-0000-4000-8000-000000000031'),
  '18750000-0000-4000-8000-00000000000a'::uuid,'a ocorrência é atribuída ao Cliente dono do objeto, nunca a outro');
select is((select count(*)::int from pcm.sso_ocorrencias_fila where outbox_id='18750000-0000-4000-8000-000000000033'),
  0,'linha de fila sem Cliente comprovável não vira ocorrência atribuída a ninguém');
select is((select ator_id from pcm.sso_ocorrencias_fila_eventos where outbox_id='18750000-0000-4000-8000-000000000031'),
  null,'evento gerado pela varredura não finge ator humano');
select is((select origem from pcm.sso_ocorrencias_fila_eventos where outbox_id='18750000-0000-4000-8000-000000000031'),
  'varredura','a origem do evento fica registrada como varredura');
select is((select status from pcm.auvo_sync_outbox where id='18750000-0000-4000-8000-000000000032'),
  'error','a varredura observa a fila do Auvo, nunca a altera');
select throws_ok(
  $$ update pcm.sso_avancos_varredura_fila set resultado='{}'::jsonb where true $$,
  '23514','nota_imutavel','página de varredura é append-only, nunca editada');

-- ─────────── AC-6: configuração do executor periódico (sem cron, ADR-1264) ──
update pcm.sso_config_executor_fila_gate set habilitado=false where id;
set local request.jwt.claims = '{"sub":"18750000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select throws_ok(
  $$ select pcm.sso_configurar_executor_fila('18750000-0000-4000-8000-000000000001','18750000-0000-4000-8000-000000000061',1,false,120,'Ajuste de intervalo') $$,
  '55000','configuracao_desabilitada','gate de configuração fechado recusa mexer no executor');
reset role;
update pcm.sso_config_executor_fila_gate set habilitado=true where id;
set local request.jwt.claims = '{"sub":"18750000-0000-4000-8000-000000000002","role":"authenticated","user_role":"supervisor"}';
set local role authenticated;
select throws_ok(
  $$ select pcm.sso_configurar_executor_fila('18750000-0000-4000-8000-000000000002','18750000-0000-4000-8000-000000000061',1,false,120,'Ajuste de intervalo') $$,
  '42501','sem_acesso','quem não é superadmin não configura o executor');
reset role;
set local request.jwt.claims = '{"sub":"18750000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

select (pcm.sso_configurar_executor_fila('18750000-0000-4000-8000-000000000001','18750000-0000-4000-8000-000000000061',1,false,120,'Ajuste de intervalo')) as config \gset
select is(:'config'::jsonb->>'cronCriado','false','configurar o executor NÃO cria cron (ADR-1264)');
select is(:'config'::jsonb->>'intervaloMinutos','120','o intervalo configurado é o que volta no recibo');
select throws_ok(
  $$ select pcm.sso_configurar_executor_fila('18750000-0000-4000-8000-000000000001','18750000-0000-4000-8000-000000000061',1,false,240,'Ajuste de intervalo') $$,
  '23505','request_id_conflitante','mesmo requestId com payload diferente é recusado');
select is(
  (pcm.sso_recibo_config_executor_fila('18750000-0000-4000-8000-000000000001','18750000-0000-4000-8000-000000000061',1,false,120,'Ajuste de intervalo'))::text,
  :'config','recibo devolve a decisão registrada sem repetir o comando');

reset role;
select is((select habilitado from pcm.sso_executor_varredura_fila where id),
  false,'o executor periódico continua desligado depois da configuração');

select * from finish();
rollback;
