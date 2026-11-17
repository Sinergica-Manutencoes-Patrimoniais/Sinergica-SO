-- E01-S193_demanda_liberacao_backlog.test.sql — pgTAP (AC-4, AC-5).
-- Migration 1854: pcm.sso_liberar_escopo_backlog — wrapper fino de pcm.sso_promover_backlog_chamado
-- (0890) que transiciona o Chamado recém-criado de 'aberto' para 'demanda'.
-- Rodar com `supabase test db` (requer Docker/Supabase local).
begin;
set local app.auvo_sync_write = 'true';
select plan(16);

-- 0) o wrapper delega o gate de 0890 — sem bypass. Gates todos fechados (default).
select throws_ok(
  $$select pcm.sso_liberar_escopo_backlog('19300000-0000-4000-8000-000000000001','19300000-0000-4000-8000-000000000002','19300000-0000-4000-8000-000000000003',1,'19300000-0000-4000-8000-000000000004','Chamado',null)$$,
  '55000', 'promocao_bloqueada', 'Wrapper herda o gate de 0890 — fechado por padrão, sem bypass'
);

-- Fixtures: cliente, usuário, concessões e a cadeia de preparo completa (necessária porque 0890
-- busca a descrição da Pendência no questionário congelado da versão aprovada — mesmo padrão de
-- E01-S174_divisao_promocao_guardas.test.sql).
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('19300000-0000-4000-8000-000000000010','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s193-demanda@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('19300000-0000-4000-8000-000000000010','superadmin','Operador S193',true);
insert into pcm.clientes(id,nome,ativo,created_by) values ('19300000-0000-4000-8000-000000000020','Cliente S193',true,'19300000-0000-4000-8000-000000000010');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('19300000-0000-4000-8000-000000000010','execucao.validar','19300000-0000-4000-8000-000000000020'),
 ('19300000-0000-4000-8000-000000000010','chamado.escopo.gerir','19300000-0000-4000-8000-000000000020'),
 ('19300000-0000-4000-8000-000000000010','backlog.promover','19300000-0000-4000-8000-000000000020');

insert into pcm.sistemas(id,cliente_id,nome) values ('19300000-0000-4000-8000-000000000040','19300000-0000-4000-8000-000000000020','Sistema S193');
insert into pcm.questionarios(id,auvo_id,nome,ativo) values ('19300000-0000-4000-8000-000000000041',193000041,'Questionário S193',true);
insert into pcm.tipos_tarefa(id,nome,auvo_id,created_by,updated_by) values ('19300000-0000-4000-8000-000000000042','Tipo S193',193000042,'19300000-0000-4000-8000-000000000010','19300000-0000-4000-8000-000000000010');
insert into pcm.planos_manutencao(id,cliente_id,nome,created_by) values ('19300000-0000-4000-8000-000000000043','19300000-0000-4000-8000-000000000020','Plano S193','19300000-0000-4000-8000-000000000010');
insert into pcm.plano_versoes(id,plano_id,numero,estado,snapshot,created_by) values ('19300000-0000-4000-8000-000000000044','19300000-0000-4000-8000-000000000043',1,'aprovado',
  '{"rotinas":[{"id":"19300000-0000-4000-8000-000000000045","rotina_logica_id":"19300000-0000-4000-8000-000000000046","alvo_tipo":"sistema","sistema_id":"19300000-0000-4000-8000-000000000040","questionario_id":"19300000-0000-4000-8000-000000000041","questionario":{"id":"19300000-0000-4000-8000-000000000041","perguntas":[{"id":"p1","texto":"Inspecionar extintor"},{"id":"p2","texto":"Verificar sinalização"},{"id":"p3","texto":"Testar iluminação de emergência"},{"id":"p4","texto":"Checar quadro elétrico"}]}}]}'::jsonb,
  '19300000-0000-4000-8000-000000000010');
insert into pcm.rotinas_manutencao(id,rotina_logica_id,plano_id,versao_id,nome,alvo_tipo,sistema_id,modo,created_by) values ('19300000-0000-4000-8000-000000000045','19300000-0000-4000-8000-000000000046','19300000-0000-4000-8000-000000000043','19300000-0000-4000-8000-000000000044','Rotina S193','sistema','19300000-0000-4000-8000-000000000040','calendario','19300000-0000-4000-8000-000000000010');
insert into pcm.planos_preventivos(id,cliente_id,sistema_id,questionario_id,tipo_tarefa_id,nome,primeira_data,intervalo_unidade,intervalo_n,created_by) values ('19300000-0000-4000-8000-000000000047','19300000-0000-4000-8000-000000000020','19300000-0000-4000-8000-000000000040','19300000-0000-4000-8000-000000000041','19300000-0000-4000-8000-000000000042','Legado S193','2026-01-01','meses',1,'19300000-0000-4000-8000-000000000010');
insert into pcm.ocorrencias_preventivas(id,plano_id,indice,vencimento,chave_externa) values ('19300000-0000-4000-8000-000000000048','19300000-0000-4000-8000-000000000047',0,'2026-01-01','teste-s193');
insert into pcm.ocorrencias_rotina_preparadas(id,plano_id,versao_id,rotina_id,rotina_logica_id,alvo_tipo,alvo_id,ciclo,vencimento_original,tolerancia_antes,tolerancia_depois,created_by) values ('19300000-0000-4000-8000-000000000090','19300000-0000-4000-8000-000000000043','19300000-0000-4000-8000-000000000044','19300000-0000-4000-8000-000000000045','19300000-0000-4000-8000-000000000046','sistema','19300000-0000-4000-8000-000000000040',0,'2026-01-01',0,0,'19300000-0000-4000-8000-000000000010');
insert into pcm.ciclos_rotina_identidades(id,rotina_logica_id,alvo_tipo,alvo_id,created_by) values ('19300000-0000-4000-8000-000000000091','19300000-0000-4000-8000-000000000046','sistema','19300000-0000-4000-8000-000000000040','19300000-0000-4000-8000-000000000010');
insert into pcm.ocorrencias_rotina_vinculos(ocorrencia_preparada_id,ciclo_id,ocorrencia_legada_id,created_by) values ('19300000-0000-4000-8000-000000000090','19300000-0000-4000-8000-000000000091','19300000-0000-4000-8000-000000000048','19300000-0000-4000-8000-000000000010');
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,status,prioridade,origem,created_by,ocorrencia_preventiva_id) values ('19300000-0000-4000-8000-000000000049','19300000-0000-4000-8000-000000000020','OS-S193','OS anterior','corretiva','solicitacao','media','manual','19300000-0000-4000-8000-000000000010','19300000-0000-4000-8000-000000000048');
insert into pcm.retorno_os_preparado(id,cliente_id,os_id,versao_id,rotina_id,chave_evento,origem) values ('19300000-0000-4000-8000-00000000004a','19300000-0000-4000-8000-000000000020','19300000-0000-4000-8000-000000000049','19300000-0000-4000-8000-000000000044','19300000-0000-4000-8000-000000000045','retorno-s193','manual_declarado');
insert into pcm.respostas_os_preparadas(id,retorno_id,chave_pergunta,resultado,obrigatoria) values
 ('19300000-0000-4000-8000-00000000004b','19300000-0000-4000-8000-00000000004a','p1','nao_ok',true),
 ('19300000-0000-4000-8000-00000000004c','19300000-0000-4000-8000-00000000004a','p2','nao_ok',true),
 ('19300000-0000-4000-8000-00000000004d','19300000-0000-4000-8000-00000000004a','p3','nao_ok',true),
 ('19300000-0000-4000-8000-00000000004e','19300000-0000-4000-8000-00000000004a','p4','nao_ok',true);
insert into pcm.sso_pendencias_tecnicas(id,cliente_id,resposta_id,retorno_id,os_id,ocorrencia_id,rotina_id,alvo_tipo,alvo_id,pergunta) values
 ('19300000-0000-4000-8000-000000000070','19300000-0000-4000-8000-000000000020','19300000-0000-4000-8000-00000000004b','19300000-0000-4000-8000-00000000004a','19300000-0000-4000-8000-000000000049','19300000-0000-4000-8000-000000000048','19300000-0000-4000-8000-000000000045','sistema','19300000-0000-4000-8000-000000000040','p1'),
 ('19300000-0000-4000-8000-000000000071','19300000-0000-4000-8000-000000000020','19300000-0000-4000-8000-00000000004c','19300000-0000-4000-8000-00000000004a','19300000-0000-4000-8000-000000000049','19300000-0000-4000-8000-000000000048','19300000-0000-4000-8000-000000000045','sistema','19300000-0000-4000-8000-000000000040','p2'),
 ('19300000-0000-4000-8000-000000000072','19300000-0000-4000-8000-000000000020','19300000-0000-4000-8000-00000000004d','19300000-0000-4000-8000-00000000004a','19300000-0000-4000-8000-000000000049','19300000-0000-4000-8000-000000000048','19300000-0000-4000-8000-000000000045','sistema','19300000-0000-4000-8000-000000000040','p3'),
 ('19300000-0000-4000-8000-000000000073','19300000-0000-4000-8000-000000000020','19300000-0000-4000-8000-00000000004e','19300000-0000-4000-8000-00000000004a','19300000-0000-4000-8000-000000000049','19300000-0000-4000-8000-000000000048','19300000-0000-4000-8000-000000000045','sistema','19300000-0000-4000-8000-000000000040','p4');

select set_config('request.jwt.claims','{"sub":"19300000-0000-4000-8000-000000000010","role":"authenticated","user_role":"superadmin"}',true);

-- Gates internos habilitados somente nesta transação; nenhum envio externo.
update pcm.sso_backlog_composicao_gate set habilitado=true where id;
update pcm.sso_promocao_backlog_gate set habilitado=true where id;
update pcm.chamado_os_gate set habilitado=true where id;
update pcm.sso_backlog_chamado_gate set habilitado=true where id;
update pcm.sso_backlog_parcela_gate set habilitado=true where id;
update pcm.sso_divisao_backlog_gate set habilitado=true where id;
update pcm.sso_suspensao_chamado_gate set habilitado=true where id;

-- Composição A (integral: p1+p2) e Composição B (parcial: p3+p4).
select pcm.sso_compor_backlog_pendencias('19300000-0000-4000-8000-000000000050','19300000-0000-4000-8000-000000000020',
  '[{"id":"19300000-0000-4000-8000-000000000070","revision":1},{"id":"19300000-0000-4000-8000-000000000071","revision":1}]'::jsonb);
select pcm.sso_compor_backlog_pendencias('19300000-0000-4000-8000-000000000051','19300000-0000-4000-8000-000000000020',
  '[{"id":"19300000-0000-4000-8000-000000000072","revision":1},{"id":"19300000-0000-4000-8000-000000000073","revision":1}]'::jsonb);
select is((select count(*)::int from pcm.sso_backlog_composicoes),2,'Duas composições criadas, nenhuma OS/Chamado ainda');
select is((select count(*)::int from pcm.chamados),0,'AC-1/2: zero Chamado antes da liberação');

-- AC-4: liberação integral de A (p1+p2) — Chamado nasce em 'demanda', não 'aberto'.
select lives_ok(
  $$select pcm.sso_liberar_escopo_backlog('19300000-0000-4000-8000-000000000052','19300000-0000-4000-8000-000000000020',
    (select id from pcm.sso_backlog_composicoes where id not in (select composicao_id from pcm.sso_backlog_pendencias where pendencia_id='19300000-0000-4000-8000-000000000072') limit 1),
    1,'19300000-0000-4000-8000-000000000061','Chamado integral',null)$$,
  'Liberação integral não lança erro com gates abertos'
);
select is(
  (select status from pcm.chamados where id='19300000-0000-4000-8000-000000000061'),
  'demanda',
  'AC-4: Chamado nasce em "demanda", não "aberto" — wrapper transicionou após 0890'
);
select is((select count(*)::int from pcm.ordens_servico where chamado_id='19300000-0000-4000-8000-000000000061'),0,'AC-4: nenhuma OS criada na liberação');
select is((select count(*)::int from pcm.chamado_escopo_parcelas where chamado_id='19300000-0000-4000-8000-000000000061'),2,'AC-4: as 2 Pendências da composição A viraram 2 parcelas');

-- Retry: mesmo request_id devolve o mesmo resultado, sem re-transicionar nem duplicar.
select is(
  (pcm.sso_liberar_escopo_backlog('19300000-0000-4000-8000-000000000052','19300000-0000-4000-8000-000000000020',
    (select composicao_id from pcm.sso_promocoes_backlog where chamado_id='19300000-0000-4000-8000-000000000061'),
    1,'19300000-0000-4000-8000-000000000061','Chamado integral',null)->>'chamadoId'),
  '19300000-0000-4000-8000-000000000061',
  'Retry do wrapper devolve o mesmo Chamado, idempotente'
);
select is((select status from pcm.chamados where id='19300000-0000-4000-8000-000000000061'),'demanda','Retry não altera o status já transicionado');
select is((select count(*)::int from pcm.sso_promocoes_backlog where chamado_id='19300000-0000-4000-8000-000000000061'),1,'Retry não duplica o histórico de promoção');

-- Dead-end por construção: Chamado em 'demanda' é recusado por RPC existente que já checava
-- status in ('aberto','convertido_os') — sem mudar uma linha de 0448.
select throws_ok(
  $$select pcm.sso_alterar_suspensao_chamado('19300000-0000-4000-8000-000000000053','19300000-0000-4000-8000-000000000061',
    (select sso_revisao from pcm.chamados where id='19300000-0000-4000-8000-000000000061'),0,'suspenso','Teste de dead-end')$$,
  '23514','chamado_indisponivel','Dead-end: Chamado em demanda não pode ser suspenso — RPC de 0448 já recusa sem mudança'
);

-- AC-5: liberação parcial — divide p3 para fora de B, libera só o destino; p4 continua em B.
select lives_ok(
  $$select pcm.sso_dividir_composicao_backlog('19300000-0000-4000-8000-000000000054','19300000-0000-4000-8000-000000000020',
    (select id from pcm.sso_backlog_composicoes where id in (select composicao_id from pcm.sso_backlog_pendencias where pendencia_id='19300000-0000-4000-8000-000000000072')),
    1,'19300000-0000-4000-8000-000000000062','["19300000-0000-4000-8000-000000000072"]'::jsonb,'Separar p3')$$,
  'Divisão de B isola p3 em composição destino'
);
select lives_ok(
  $$select pcm.sso_liberar_escopo_backlog('19300000-0000-4000-8000-000000000055','19300000-0000-4000-8000-000000000020',
    '19300000-0000-4000-8000-000000000062',1,'19300000-0000-4000-8000-000000000063','Chamado parcial',null)$$,
  'Liberação do destino (só p3) não lança erro'
);
select is((select status from pcm.chamados where id='19300000-0000-4000-8000-000000000063'),'demanda','AC-5: Chamado parcial também nasce em demanda');
select is((select count(*)::int from pcm.chamado_escopo_parcelas where chamado_id='19300000-0000-4000-8000-000000000063'),1,'AC-5: só p3 virou parcela no Chamado parcial');
select is(
  (select count(*)::int from pcm.sso_backlog_pendencias b
     where b.pendencia_id='19300000-0000-4000-8000-000000000073'
       and not exists(select 1 from pcm.sso_backlog_chamado_vinculos v where v.composicao_id=b.composicao_id)),
  1,
  'AC-5: p4 continua no Backlog (composição B), sem vínculo a Chamado'
);

select * from finish();
rollback;
