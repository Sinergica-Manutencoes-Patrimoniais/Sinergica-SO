-- Guardas iniciais de E01-S174. Não substitui os cenários de sucesso e concorrência.
begin;
set local app.auvo_sync_write = 'true';
select plan(24);

select throws_ok(
  $$select pcm.sso_dividir_composicao_backlog('17400000-0000-4000-8000-000000000001','17400000-0000-4000-8000-000000000002','17400000-0000-4000-8000-000000000003',1,'17400000-0000-4000-8000-000000000004','["17400000-0000-4000-8000-000000000005"]'::jsonb,'Motivo')$$,
  '55000', 'divisao_backlog_bloqueada', 'Divisão permanece fechada por padrão'
);
select throws_ok(
  $$select pcm.sso_promover_backlog_chamado('17400000-0000-4000-8000-000000000001','17400000-0000-4000-8000-000000000002','17400000-0000-4000-8000-000000000003',1,'17400000-0000-4000-8000-000000000004','Chamado',null)$$,
  '55000', 'promocao_bloqueada', 'Promoção permanece fechada por padrão'
);

update pcm.sso_divisao_backlog_gate set habilitado=true where id;
update pcm.sso_promocao_backlog_gate set habilitado=true where id;
select set_config('request.jwt.claims', '{}', true);
select throws_ok(
  $$select pcm.sso_dividir_composicao_backlog('17400000-0000-4000-8000-000000000001','17400000-0000-4000-8000-000000000002','17400000-0000-4000-8000-000000000003',1,'17400000-0000-4000-8000-000000000004','["17400000-0000-4000-8000-000000000005"]'::jsonb,'Motivo')$$,
  '22023', 'pedido_invalido', 'Divisão não aceita ator ausente'
);
select throws_ok(
  $$select pcm.sso_promover_backlog_chamado('17400000-0000-4000-8000-000000000001','17400000-0000-4000-8000-000000000002','17400000-0000-4000-8000-000000000003',1,'17400000-0000-4000-8000-000000000004','Chamado',null)$$,
  '22023', 'pedido_invalido', 'Promoção não aceita ator ausente'
);
select ok(not has_table_privilege('authenticated','pcm.sso_divisoes_backlog','UPDATE'), 'Histórico de divisão não tem UPDATE concedido ao usuário');
select ok(not has_table_privilege('authenticated','pcm.sso_promocoes_backlog','DELETE'), 'Histórico de promoção não tem DELETE concedido ao usuário');

-- Fixtures mínimas reais para autorização e revisão; nenhuma OS é criada.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('17400000-0000-4000-8000-000000000010','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s174-backlog@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('17400000-0000-4000-8000-000000000010','superadmin','Operador S174',true);
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('17400000-0000-4000-8000-000000000020','Cliente S174 A',true,'17400000-0000-4000-8000-000000000010'),
 ('17400000-0000-4000-8000-000000000021','Cliente S174 B',true,'17400000-0000-4000-8000-000000000010');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('17400000-0000-4000-8000-000000000010','execucao.validar','17400000-0000-4000-8000-000000000020'),
 ('17400000-0000-4000-8000-000000000010','chamado.escopo.gerir','17400000-0000-4000-8000-000000000020'),
 ('17400000-0000-4000-8000-000000000010','backlog.promover','17400000-0000-4000-8000-000000000020');
insert into pcm.sso_backlog_composicoes(id,cliente_id,alvo_tipo,alvo_id,revisao,criado_por,gravidade,urgencia,tendencia,dor_cliente)
values ('17400000-0000-4000-8000-000000000030','17400000-0000-4000-8000-000000000020','sistema','17400000-0000-4000-8000-000000000040',1,'17400000-0000-4000-8000-000000000010',2,3,4,5);
select set_config('request.jwt.claims','{"sub":"17400000-0000-4000-8000-000000000010","role":"authenticated","user_role":"superadmin"}',true);
select throws_ok($$select pcm.sso_dividir_composicao_backlog('17400000-0000-4000-8000-000000000051','17400000-0000-4000-8000-000000000021','17400000-0000-4000-8000-000000000030',1,'17400000-0000-4000-8000-000000000060','["17400000-0000-4000-8000-000000000070"]'::jsonb,'Motivo')$$,'42501',null,'Divisão não atravessa Cliente sem concessão');
select throws_ok($$select pcm.sso_promover_backlog_chamado('17400000-0000-4000-8000-000000000052','17400000-0000-4000-8000-000000000021','17400000-0000-4000-8000-000000000030',1,'17400000-0000-4000-8000-000000000061','Chamado',null)$$,'42501',null,'Promoção não atravessa Cliente sem concessão');
select throws_ok($$select pcm.sso_dividir_composicao_backlog('17400000-0000-4000-8000-000000000053','17400000-0000-4000-8000-000000000020','17400000-0000-4000-8000-000000000030',2,'17400000-0000-4000-8000-000000000060','["17400000-0000-4000-8000-000000000070"]'::jsonb,'Motivo')$$,'40001',null,'Divisão recusa revisão obsoleta');
select throws_ok($$select pcm.sso_promover_backlog_chamado('17400000-0000-4000-8000-000000000054','17400000-0000-4000-8000-000000000020','17400000-0000-4000-8000-000000000030',2,'17400000-0000-4000-8000-000000000061','Chamado',null)$$,'40001',null,'Promoção recusa revisão obsoleta');

-- Cadeia sintética real: mesmo Cliente, Sistema, Rotina, ocorrência, OS e retorno.
-- A OS é fixture anterior ao comando; o teste compara a contagem depois dela.
insert into pcm.sistemas(id,cliente_id,nome) values ('17400000-0000-4000-8000-000000000040','17400000-0000-4000-8000-000000000020','Sistema S174');
insert into pcm.questionarios(id,auvo_id,nome,ativo) values ('17400000-0000-4000-8000-000000000041',174000041,'Questionário S174',true);
insert into pcm.tipos_tarefa(id,nome,auvo_id,created_by,updated_by) values ('17400000-0000-4000-8000-000000000042','Tipo S174',174000042,'17400000-0000-4000-8000-000000000010','17400000-0000-4000-8000-000000000010');
insert into pcm.planos_manutencao(id,cliente_id,nome,created_by) values ('17400000-0000-4000-8000-000000000043','17400000-0000-4000-8000-000000000020','Plano S174','17400000-0000-4000-8000-000000000010');
insert into pcm.plano_versoes(id,plano_id,numero,estado,snapshot,created_by) values ('17400000-0000-4000-8000-000000000044','17400000-0000-4000-8000-000000000043',1,'aprovado','{"rotinas":[{"id":"17400000-0000-4000-8000-000000000045","rotina_logica_id":"17400000-0000-4000-8000-000000000046","alvo_tipo":"sistema","sistema_id":"17400000-0000-4000-8000-000000000040","questionario_id":"17400000-0000-4000-8000-000000000041","questionario":{"id":"17400000-0000-4000-8000-000000000041","perguntas":[{"id":"p1","texto":"Inspecionar extintor"},{"id":"p2","texto":"Verificar sinalização"}]}}]}'::jsonb,'17400000-0000-4000-8000-000000000010');
insert into pcm.rotinas_manutencao(id,rotina_logica_id,plano_id,versao_id,nome,alvo_tipo,sistema_id,modo,created_by) values ('17400000-0000-4000-8000-000000000045','17400000-0000-4000-8000-000000000046','17400000-0000-4000-8000-000000000043','17400000-0000-4000-8000-000000000044','Rotina S174','sistema','17400000-0000-4000-8000-000000000040','calendario','17400000-0000-4000-8000-000000000010');
insert into pcm.planos_preventivos(id,cliente_id,sistema_id,questionario_id,tipo_tarefa_id,nome,primeira_data,intervalo_unidade,intervalo_n,created_by) values ('17400000-0000-4000-8000-000000000047','17400000-0000-4000-8000-000000000020','17400000-0000-4000-8000-000000000040','17400000-0000-4000-8000-000000000041','17400000-0000-4000-8000-000000000042','Legado S174','2026-01-01','meses',1,'17400000-0000-4000-8000-000000000010');
insert into pcm.ocorrencias_preventivas(id,plano_id,indice,vencimento,chave_externa) values ('17400000-0000-4000-8000-000000000048','17400000-0000-4000-8000-000000000047',0,'2026-01-01','teste-s174');
insert into pcm.ocorrencias_rotina_preparadas(id,plano_id,versao_id,rotina_id,rotina_logica_id,alvo_tipo,alvo_id,ciclo,vencimento_original,tolerancia_antes,tolerancia_depois,created_by) values ('17400000-0000-4000-8000-000000000090','17400000-0000-4000-8000-000000000043','17400000-0000-4000-8000-000000000044','17400000-0000-4000-8000-000000000045','17400000-0000-4000-8000-000000000046','sistema','17400000-0000-4000-8000-000000000040',0,'2026-01-01',0,0,'17400000-0000-4000-8000-000000000010');
insert into pcm.ciclos_rotina_identidades(id,rotina_logica_id,alvo_tipo,alvo_id,created_by) values ('17400000-0000-4000-8000-000000000091','17400000-0000-4000-8000-000000000046','sistema','17400000-0000-4000-8000-000000000040','17400000-0000-4000-8000-000000000010');
insert into pcm.ocorrencias_rotina_vinculos(ocorrencia_preparada_id,ciclo_id,ocorrencia_legada_id,created_by) values ('17400000-0000-4000-8000-000000000090','17400000-0000-4000-8000-000000000091','17400000-0000-4000-8000-000000000048','17400000-0000-4000-8000-000000000010');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,status,prioridade,origem,created_by,ocorrencia_preventiva_id) values ('17400000-0000-4000-8000-000000000049','17400000-0000-4000-8000-000000000020','OS-S174','OS anterior','corretiva','solicitacao','media','manual','17400000-0000-4000-8000-000000000010','17400000-0000-4000-8000-000000000048');
insert into pcm.retorno_os_preparado(id,cliente_id,os_id,versao_id,rotina_id,chave_evento,origem) values ('17400000-0000-4000-8000-00000000004a','17400000-0000-4000-8000-000000000020','17400000-0000-4000-8000-000000000049','17400000-0000-4000-8000-000000000044','17400000-0000-4000-8000-000000000045','retorno-s174','manual_declarado');
insert into pcm.respostas_os_preparadas(id,retorno_id,chave_pergunta,resultado,obrigatoria) values
 ('17400000-0000-4000-8000-00000000004b','17400000-0000-4000-8000-00000000004a','p1','nao_ok',true),
 ('17400000-0000-4000-8000-00000000004c','17400000-0000-4000-8000-00000000004a','p2','nao_ok',true);
insert into pcm.sso_pendencias_tecnicas(id,cliente_id,resposta_id,retorno_id,os_id,ocorrencia_id,rotina_id,alvo_tipo,alvo_id,pergunta) values
 ('17400000-0000-4000-8000-000000000070','17400000-0000-4000-8000-000000000020','17400000-0000-4000-8000-00000000004b','17400000-0000-4000-8000-00000000004a','17400000-0000-4000-8000-000000000049','17400000-0000-4000-8000-000000000048','17400000-0000-4000-8000-000000000045','sistema','17400000-0000-4000-8000-000000000040','p1'),
 ('17400000-0000-4000-8000-000000000071','17400000-0000-4000-8000-000000000020','17400000-0000-4000-8000-00000000004c','17400000-0000-4000-8000-00000000004a','17400000-0000-4000-8000-000000000049','17400000-0000-4000-8000-000000000048','17400000-0000-4000-8000-000000000045','sistema','17400000-0000-4000-8000-000000000040','p2');
insert into pcm.sso_backlog_pendencias(composicao_id,pendencia_id,revisao_origem) values
 ('17400000-0000-4000-8000-000000000030','17400000-0000-4000-8000-000000000070',1),('17400000-0000-4000-8000-000000000030','17400000-0000-4000-8000-000000000071',1);
create temporary table s174_os_antes as select count(*)::int as n from pcm.ordens_servico;
select lives_ok($$select pcm.sso_dividir_composicao_backlog('17400000-0000-4000-8000-000000000080','17400000-0000-4000-8000-000000000020','17400000-0000-4000-8000-000000000030',1,'17400000-0000-4000-8000-000000000060','["17400000-0000-4000-8000-000000000070"]'::jsonb,'Separar escopo')$$,'Divisão parcial preserva Pendências');
select is((pcm.sso_dividir_composicao_backlog('17400000-0000-4000-8000-000000000080','17400000-0000-4000-8000-000000000020','17400000-0000-4000-8000-000000000030',1,'17400000-0000-4000-8000-000000000060','["17400000-0000-4000-8000-000000000070"]'::jsonb,'Separar escopo')->>'destinoId'),'17400000-0000-4000-8000-000000000060','Retry devolve mesmo destino');
select is((select count(*)::int from pcm.sso_backlog_pendencias where composicao_id in ('17400000-0000-4000-8000-000000000030','17400000-0000-4000-8000-000000000060')),2,'Nenhuma Pendência é descartada');
select ok((select bool_and(gravidade is null and urgencia is null and tendencia is null and dor_cliente is null) from pcm.sso_backlog_composicoes where id in ('17400000-0000-4000-8000-000000000030','17400000-0000-4000-8000-000000000060')),'Ambas composições exigem nova avaliação GUTD');
select is((select count(*)::int from pcm.sso_divisoes_backlog where request_id='17400000-0000-4000-8000-000000000080'),1,'Histórico da divisão é único no retry');
select is((select count(*)::int from pcm.ordens_servico),(select n from s174_os_antes),'Divisão não cria OS');

-- Gates internos habilitados somente nesta transação; nenhum envio externo.
update pcm.chamado_os_gate set habilitado=true where id;
update pcm.sso_backlog_chamado_gate set habilitado=true where id;
update pcm.sso_backlog_parcela_gate set habilitado=true where id;
select lives_ok($$select pcm.sso_promover_backlog_chamado('17400000-0000-4000-8000-000000000081','17400000-0000-4000-8000-000000000020','17400000-0000-4000-8000-000000000060',1,'17400000-0000-4000-8000-000000000061','Corrigir extintor',null)$$,'Promove composição dividida para Chamado sem criar OS');
select is((pcm.sso_promover_backlog_chamado('17400000-0000-4000-8000-000000000081','17400000-0000-4000-8000-000000000020','17400000-0000-4000-8000-000000000060',1,'17400000-0000-4000-8000-000000000061','Corrigir extintor',null)->>'chamadoId'),'17400000-0000-4000-8000-000000000061','Retry da promoção devolve mesmo Chamado');
select is((select descricao from pcm.chamado_escopo_parcelas where chamado_id='17400000-0000-4000-8000-000000000061'),'Inspecionar extintor','Parcela usa texto do snapshot histórico');
select is((select count(*)::int from pcm.ordens_servico),(select n from s174_os_antes),'Promoção não cria OS');

-- S166/S173: origem Grupo vinculada a OS distinta não pode entrar no consumidor legado.
insert into pcm.areas(id,cliente_id,nome) values ('17400000-0000-4000-8000-0000000000a1','17400000-0000-4000-8000-000000000020','Área');
insert into pcm.locais(id,area_id,nome) values ('17400000-0000-4000-8000-0000000000a2','17400000-0000-4000-8000-0000000000a1','Local');
insert into pcm.equipamento_categorias(id,nome) values ('17400000-0000-4000-8000-0000000000a3','Categoria S174');
insert into pcm.grupos_quantitativos(id,cliente_id,local_id,categoria_id,nome,quantidade,created_by,updated_by) values ('17400000-0000-4000-8000-0000000000a4','17400000-0000-4000-8000-000000000020','17400000-0000-4000-8000-0000000000a2','17400000-0000-4000-8000-0000000000a3','Luminárias',10,'17400000-0000-4000-8000-000000000010','17400000-0000-4000-8000-000000000010');
insert into pcm.rotinas_manutencao(id,rotina_logica_id,plano_id,versao_id,nome,alvo_tipo,grupo_id,modo,created_by) values ('17400000-0000-4000-8000-0000000000a5','17400000-0000-4000-8000-0000000000a6','17400000-0000-4000-8000-000000000043','17400000-0000-4000-8000-000000000044','Grupo','grupo','17400000-0000-4000-8000-0000000000a4','calendario','17400000-0000-4000-8000-000000000010');
insert into pcm.ocorrencias_rotina_preparadas(id,plano_id,versao_id,rotina_id,rotina_logica_id,alvo_tipo,alvo_id,ciclo,vencimento_original,tolerancia_antes,tolerancia_depois,created_by) values ('17400000-0000-4000-8000-0000000000a7','17400000-0000-4000-8000-000000000043','17400000-0000-4000-8000-000000000044','17400000-0000-4000-8000-0000000000a5','17400000-0000-4000-8000-0000000000a6','grupo','17400000-0000-4000-8000-0000000000a4',0,'2026-01-01',0,0,'17400000-0000-4000-8000-000000000010');
insert into pcm.sso_ocorrencias_grupo(id,request_id,cliente_id,plano_id,versao_id,rotina_id,grupo_id,calendario_preparado_id,vencimento_original,grupo_revisao,quantidade_snapshot,ator_id,payload) values ('17400000-0000-4000-8000-0000000000a8','17400000-0000-4000-8000-0000000000a9','17400000-0000-4000-8000-000000000020','17400000-0000-4000-8000-000000000043','17400000-0000-4000-8000-000000000044','17400000-0000-4000-8000-0000000000a5','17400000-0000-4000-8000-0000000000a4','17400000-0000-4000-8000-0000000000a7','2026-01-01',1,10,'17400000-0000-4000-8000-000000000010','{}');
-- A associação posterior não pode retroativamente atribuir Grupo a retorno existente.
savepoint s173_retorno_preexistente;
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('17400000-0000-4000-8000-000000000010','plano.gerir','17400000-0000-4000-8000-000000000020');
update pcm.sso_vinculo_os_grupo_gate set habilitado=true where id;
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,status,prioridade,origem,created_by) values ('17400000-0000-4000-8000-0000000000ad','17400000-0000-4000-8000-000000000020','OS-RETORNO-S173','OS retorno anterior','corretiva','solicitacao','media','manual','17400000-0000-4000-8000-000000000010');
insert into pcm.retorno_os_preparado(id,cliente_id,os_id,versao_id,rotina_id,chave_evento,origem) values ('17400000-0000-4000-8000-0000000000ae','17400000-0000-4000-8000-000000000020','17400000-0000-4000-8000-0000000000ad','17400000-0000-4000-8000-000000000044','17400000-0000-4000-8000-000000000045','retorno-anterior-grupo-s173','manual_declarado');
select throws_ok($$select pcm.sso_declarar_vinculo_os_grupo('17400000-0000-4000-8000-0000000000af','17400000-0000-4000-8000-000000000020','17400000-0000-4000-8000-0000000000a8','17400000-0000-4000-8000-0000000000ad','Conferido')$$,'55000','os_com_retorno_exige_reconciliacao','Vínculo Grupo não atribui nova origem a OS com retorno anterior');
rollback to savepoint s173_retorno_preexistente;
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,status,prioridade,origem,created_by) values ('17400000-0000-4000-8000-0000000000aa','17400000-0000-4000-8000-000000000020','OS-GRUPO-S174','OS de Grupo','corretiva','solicitacao','media','manual','17400000-0000-4000-8000-000000000010');
insert into pcm.sso_vinculos_os_grupo(request_id,cliente_id,ocorrencia_grupo_id,os_id,motivo,ator_id,payload) values ('17400000-0000-4000-8000-0000000000ab','17400000-0000-4000-8000-000000000020','17400000-0000-4000-8000-0000000000a8','17400000-0000-4000-8000-0000000000aa','Vínculo de teste','17400000-0000-4000-8000-000000000010','{}');
select throws_ok($$insert into pcm.retorno_os_preparado(id,cliente_id,os_id,versao_id,rotina_id,chave_evento,origem) values ('17400000-0000-4000-8000-0000000000ac','17400000-0000-4000-8000-000000000020','17400000-0000-4000-8000-0000000000aa','17400000-0000-4000-8000-000000000044','17400000-0000-4000-8000-0000000000a5','retorno-grupo-s174','manual_declarado')$$,'55000','origem_consumidores_nao_integrados','Retorno de Grupo permanece bloqueado');
select is((select ocorrencia_preventiva_id from pcm.ordens_servico where id='17400000-0000-4000-8000-000000000049'),'17400000-0000-4000-8000-000000000048'::uuid,'Vínculo legado da OS original permanece');
select is((select count(*)::int from pcm.sso_pendencias_tecnicas where ocorrencia_id='17400000-0000-4000-8000-000000000048'),2,'Pendências legadas preservam ocorrência');

select * from finish();
rollback;
