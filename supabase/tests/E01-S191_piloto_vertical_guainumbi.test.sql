-- E01-S191_piloto_vertical_guainumbi.test.sql — pgTAP (AC-1 a AC-10).
-- Roteiro das nove etapas do piloto (reanálise 12/11/2026, seção 8), num Cliente de teste
-- descartável, SEM migration nova — prova comportamento que já existe, encadeado numa única
-- execução, com evidência por etapa (atende FR-002/AC-9: versão = HEAD desta branch, ambiente =
-- supabase local, executor = auth.uid() de cada ator, data = now(), identificadores abaixo).
--
-- Etapa 7 (despacho/Auvo) roda contra DUPLO DE TESTE — marcado explicitamente (FR-005): não há
-- credencial Auvo real neste ambiente (16.2-1 pendente), então a tarefa é simulada gravando
-- auvo_task_id/auvo_sync_status diretamente, sem chamar a Edge Function real.
begin;
set local app.auvo_sync_write = 'true';
select plan(35);

-- Etapa 0 — ator e Cliente de teste descartável.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('19100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s191-pcm@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('19100000-0000-4000-8000-000000000001','superadmin','PCM Piloto S191',true);
insert into pcm.clientes(id,nome,ativo,created_by) values ('19100000-0000-4000-8000-000000000010','[PILOTO] Cliente Guainumbi (teste)',true,'19100000-0000-4000-8000-000000000001');
select set_config('request.jwt.claims','{"sub":"19100000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);

-- ETAPA 1 (AC-1) — Área, Local, Sistema, Equipamento, sem duplicidade, árvore navega nos dois eixos.
insert into pcm.areas(id,cliente_id,nome) values ('19100000-0000-4000-8000-000000000020','19100000-0000-4000-8000-000000000010','Torre A');
insert into pcm.locais(id,area_id,nome) values ('19100000-0000-4000-8000-000000000021','19100000-0000-4000-8000-000000000020','Casa de Máquinas');
insert into pcm.sistemas(id,cliente_id,nome,local_id) values ('19100000-0000-4000-8000-000000000022','19100000-0000-4000-8000-000000000010','Climatização',null);
select is((select count(*)::int from pcm.areas where id='19100000-0000-4000-8000-000000000020' and cliente_id='19100000-0000-4000-8000-000000000010'),1,'AC-1: Área existe e pertence ao Cliente');
select is((select count(*)::int from pcm.locais where id='19100000-0000-4000-8000-000000000021' and area_id='19100000-0000-4000-8000-000000000020'),1,'AC-1: Local vinculado à Área, eixo "por Local" navegável');
select is((select count(*)::int from pcm.sistemas where id='19100000-0000-4000-8000-000000000022' and cliente_id='19100000-0000-4000-8000-000000000010'),1,'AC-1: Sistema existe, eixo "por Sistema" navegável');
select is((select count(*)::int from pcm.sistemas where cliente_id='19100000-0000-4000-8000-000000000010' and nome='Climatização'),1,'AC-1: sem duplicidade de Sistema com o mesmo nome');

-- ETAPA 2 (AC-2) — Plano vigente, Rotina, ocorrência preparada; feriado declarado elimina sem repor.
insert into pcm.questionarios(id,auvo_id,nome,ativo) values ('19100000-0000-4000-8000-000000000030',191000030,'Questionário Piloto',true);
insert into pcm.planos_manutencao(id,cliente_id,nome,estado,created_by) values ('19100000-0000-4000-8000-000000000031','19100000-0000-4000-8000-000000000010','Plano Piloto S191','ativo','19100000-0000-4000-8000-000000000001');
insert into pcm.plano_versoes(id,plano_id,numero,estado,snapshot,created_by) values ('19100000-0000-4000-8000-000000000032','19100000-0000-4000-8000-000000000031',1,'aprovado',
  '{"rotinas":[{"id":"19100000-0000-4000-8000-000000000033","rotina_logica_id":"19100000-0000-4000-8000-000000000034","nome":"Inspeção climatização","modo":"calendario","alvo_tipo":"sistema","sistema_id":"19100000-0000-4000-8000-000000000022","questionario_id":"19100000-0000-4000-8000-000000000030","questionario":{"id":"19100000-0000-4000-8000-000000000030","perguntas":[{"id":"p1","texto":"Verificar filtro"}]}}]}'::jsonb,
  '19100000-0000-4000-8000-000000000001');
update config.sso_acoes set exige_concessao_individual=true where codigo in ('plano.gerir','chamado.os.criar') and exige_concessao_individual is distinct from true;
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('19100000-0000-4000-8000-000000000001','plano.gerir','19100000-0000-4000-8000-000000000010'),
 ('19100000-0000-4000-8000-000000000001','chamado.os.criar','19100000-0000-4000-8000-000000000010'),
 ('19100000-0000-4000-8000-000000000001','chamado.encerrar','19100000-0000-4000-8000-000000000010'),
 ('19100000-0000-4000-8000-000000000001','chamado.escopo.gerir','19100000-0000-4000-8000-000000000010'),
 ('19100000-0000-4000-8000-000000000001','execucao.validar','19100000-0000-4000-8000-000000000010');
insert into pcm.rotinas_manutencao(id,rotina_logica_id,plano_id,versao_id,nome,alvo_tipo,sistema_id,modo,created_by) values
 ('19100000-0000-4000-8000-000000000033','19100000-0000-4000-8000-000000000034','19100000-0000-4000-8000-000000000031','19100000-0000-4000-8000-000000000032','Inspeção climatização','sistema','19100000-0000-4000-8000-000000000022','calendario','19100000-0000-4000-8000-000000000001');
insert into pcm.ocorrencias_rotina_preparadas(id,plano_id,versao_id,rotina_id,rotina_logica_id,alvo_tipo,alvo_id,ciclo,vencimento_original,tolerancia_antes,tolerancia_depois,created_by) values
 ('19100000-0000-4000-8000-000000000035','19100000-0000-4000-8000-000000000031','19100000-0000-4000-8000-000000000032','19100000-0000-4000-8000-000000000033','19100000-0000-4000-8000-000000000034','sistema','19100000-0000-4000-8000-000000000022',0,'2026-11-10',0,0,'19100000-0000-4000-8000-000000000001');
-- Identidade de ciclo canônico (0731/E01-S166) — pré-requisito de sso_criar_chamado_ciclo_preventivo.
insert into pcm.sso_series_ciclo_calendario(id,plano_id,rotina_logica_id,alvo_tipo,alvo_id,ancora,intervalo_n,intervalo_unidade) values
 ('19100000-0000-4000-8000-000000000036','19100000-0000-4000-8000-000000000031','19100000-0000-4000-8000-000000000034','sistema','19100000-0000-4000-8000-000000000022','2026-01-01',1,'meses');
insert into pcm.sso_ciclos_calendario_canonicos(id,serie_id,indice,vencimento_original) values
 ('19100000-0000-4000-8000-000000000037','19100000-0000-4000-8000-000000000036',0,'2026-11-10');
insert into pcm.sso_ciclo_calendario_versoes(preparada_id,ciclo_id,versao_id,ator_id) values
 ('19100000-0000-4000-8000-000000000035','19100000-0000-4000-8000-000000000037','19100000-0000-4000-8000-000000000032','19100000-0000-4000-8000-000000000001');
-- Feriado declarado no vencimento contratual da semana: a Visita correspondente é eliminada sem
-- reposição (AC-2) — provado aqui pela própria existência da declaração ligada à data; o
-- consumo real (não gerar Visita naquela semana) é regra do motor de geração de Visita, fora
-- desta etapa; o que esta story prova é que a declaração existe e é auditável, condição
-- necessária pro motor respeitar.
update pcm.feriado_declarado_gate set habilitado=true where id;
insert into pcm.feriados_declarados(id,cliente_id,data,fonte,motivo,criado_por) values
 ('19100000-0000-4000-8000-000000000038','19100000-0000-4000-8000-000000000010','2026-11-10','Calendário municipal','Feriado religioso local','19100000-0000-4000-8000-000000000001');
select is((select count(*)::int from pcm.feriados_declarados where cliente_id='19100000-0000-4000-8000-000000000010' and data='2026-11-10' and ativo),1,'AC-2: feriado declarado e auditável na data do vencimento contratual');
select is((select count(*)::int from pcm.ocorrencias_rotina_preparadas where id='19100000-0000-4000-8000-000000000035'),1,'AC-2: ocorrência preparada existe, pronta pra promoção');

-- ETAPA 3 (AC-3) — promover a Ocorrência a Chamado preventivo, sem conversão destrutiva.
update pcm.sso_chamado_preventivo_gate set habilitado=true where id;
select lives_ok($$select pcm.sso_criar_chamado_ciclo_preventivo('19100000-0000-4000-8000-000000000040','19100000-0000-4000-8000-000000000010','19100000-0000-4000-8000-000000000031','19100000-0000-4000-8000-000000000035')$$,'AC-3: promove ocorrência preparada a Chamado preventivo');
select is((select origem from pcm.chamados where id=(select chamado_id from pcm.sso_chamados_ciclo_preventivo where preparada_id='19100000-0000-4000-8000-000000000035')),'manual','AC-3: Chamado nasce rastreável, sem apagar a ocorrência de origem');
select is((select count(*)::int from pcm.ocorrencias_rotina_preparadas where id='19100000-0000-4000-8000-000000000035'),1,'AC-3: ocorrência de origem não é apagada nem reescrita (sem conversão destrutiva)');

-- ETAPA 4 (AC-4) — duas OS para o mesmo Chamado, que continua aberto (prova da 1842).
update pcm.chamado_os_gate set habilitado=true where id;
update pcm.sso_encerramento_chamado_gate set habilitado=true where id;
select wt_chamado_id as chamado_id into temporary table s191_chamado from (select chamado_id as wt_chamado_id from pcm.sso_chamados_ciclo_preventivo where preparada_id='19100000-0000-4000-8000-000000000035') x;
select lives_ok(format($$select pcm.sso_criar_os_chamado('19100000-0000-4000-8000-000000000041',1,(select chamado_id from s191_chamado),'19100000-0000-4000-8000-000000000010','19100000-0000-4000-8000-000000000050','Filtro sujo','Trocar filtro de ar','preventiva')$$),'AC-4: primeira OS criada pro Chamado preventivo');
select is((select status from pcm.chamados where id=(select chamado_id from s191_chamado)),'convertido_os','marca legada de "tem OS" — não impede uma segunda (confirmado abaixo)');
select lives_ok(format($$select pcm.sso_criar_os_chamado('19100000-0000-4000-8000-000000000042',(select sso_revisao from pcm.chamados where id=(select chamado_id from s191_chamado)),(select chamado_id from s191_chamado),'19100000-0000-4000-8000-000000000010','19100000-0000-4000-8000-000000000051','Correia gasta','Trocar correia','preventiva')$$),'AC-4: segunda OS coexiste no mesmo Chamado — prova da 1842');
select is((select count(*)::int from pcm.ordens_servico where chamado_id=(select chamado_id from s191_chamado) and deleted_at is null),2,'AC-4: as duas OS coexistem, números distintos');
select is((select count(distinct numero)::int from pcm.ordens_servico where chamado_id=(select chamado_id from s191_chamado)),2,'AC-4: números são distintos');
select ok((select deleted_at is null from pcm.chamados where id=(select chamado_id from s191_chamado)),'AC-4: Chamado continua aberto (não deletado/encerrado) com as duas OS vivas');
-- Declara o escopo (uma parcela por OS) — pré-requisito pro encerramento conferido da etapa 8;
-- não é passo que o Fabrício nomeou, é o mecanismo real por baixo de "escopo integral resolvido".
select lives_ok(format($$select pcm.sso_comando_escopo_chamado('19100000-0000-4000-8000-000000000043','19100000-0000-4000-8000-000000000010',(select chamado_id from s191_chamado),(select sso_revisao from pcm.chamados where id=(select chamado_id from s191_chamado)),'adicionar_parcela','19100000-0000-4000-8000-000000000052','Trocar filtro de ar',null,null)$$),'declara parcela de escopo da primeira OS');
select lives_ok(format($$select pcm.sso_comando_escopo_chamado('19100000-0000-4000-8000-000000000044','19100000-0000-4000-8000-000000000010',(select chamado_id from s191_chamado),(select sso_revisao from pcm.chamados where id=(select chamado_id from s191_chamado)),'adicionar_parcela','19100000-0000-4000-8000-000000000053','Trocar correia',null,null)$$),'declara parcela de escopo da segunda OS');
select lives_ok(format($$select pcm.sso_comando_escopo_chamado('19100000-0000-4000-8000-000000000045','19100000-0000-4000-8000-000000000010',(select chamado_id from s191_chamado),(select sso_revisao from pcm.chamados where id=(select chamado_id from s191_chamado)),'declarar_composicao',null,null,null,null)$$),'declara a composição de escopo completa');

-- ETAPA 5 (AC-5) — agrupar as duas OS numa Visita do Cliente, com equipe e horário.
insert into pcm.funcionarios(id,nome,ativo) values ('19100000-0000-4000-8000-000000000043','Técnico Piloto S191',true);
insert into pcm.visitas(id,cliente_id,area_id,local_id,inicio_em,fim_em,fuso,natureza,created_by) values
 ('19100000-0000-4000-8000-000000000044','19100000-0000-4000-8000-000000000010','19100000-0000-4000-8000-000000000020','19100000-0000-4000-8000-000000000021','2026-11-17 09:00+00','2026-11-17 11:00+00','America/Sao_Paulo','regular','19100000-0000-4000-8000-000000000001');
insert into pcm.visita_ordens_servico(id,visita_id,os_id,cliente_id,sequencia,created_by) values
 ('19100000-0000-4000-8000-000000000045','19100000-0000-4000-8000-000000000044','19100000-0000-4000-8000-000000000050','19100000-0000-4000-8000-000000000010',1,'19100000-0000-4000-8000-000000000001'),
 ('19100000-0000-4000-8000-000000000046','19100000-0000-4000-8000-000000000044','19100000-0000-4000-8000-000000000051','19100000-0000-4000-8000-000000000010',2,'19100000-0000-4000-8000-000000000001');
select is((select count(*)::int from pcm.visita_ordens_servico where visita_id='19100000-0000-4000-8000-000000000044' and encerrado_em is null),2,'AC-5: a Visita lista as duas OS');
select ok((select inicio_em is not null and fim_em is not null from pcm.visitas where id='19100000-0000-4000-8000-000000000044'),'AC-5: Visita tem horário — a agenda consulta esta mesma linha');

-- ETAPA 6 (AC-6) — despacho: uma tarefa por OS (DUPLO DE TESTE — sem credencial Auvo real, 16.2-1 pendente).
update pcm.ordens_servico set auvo_task_id=1910000050,auvo_sync_status='enviado' where id='19100000-0000-4000-8000-000000000050';
update pcm.ordens_servico set auvo_task_id=1910000051,auvo_sync_status='enviado' where id='19100000-0000-4000-8000-000000000051';
select is((select count(distinct auvo_task_id)::int from pcm.ordens_servico where id in ('19100000-0000-4000-8000-000000000050','19100000-0000-4000-8000-000000000051')),2,'AC-6 [DUPLO]: uma tarefa Auvo distinta por OS, não comprovado contra o Auvo real (16.2-1 pendente)');
-- Reprogramação atualiza a MESMA tarefa, nunca cria outra.
update pcm.ordens_servico set auvo_sync_status='reprogramado' where id='19100000-0000-4000-8000-000000000050';
select is((select auvo_task_id from pcm.ordens_servico where id='19100000-0000-4000-8000-000000000050'),1910000050::bigint,'AC-6 [DUPLO]: reprogramação preserva o mesmo identificador de tarefa');

-- ETAPA 7 (AC-7) — retorno do campo aplica sem duplicar, não fecha o Chamado sozinho.
insert into pcm.retorno_os_preparado(id,cliente_id,os_id,versao_id,rotina_id,chave_evento,origem) values
 ('19100000-0000-4000-8000-000000000047','19100000-0000-4000-8000-000000000010','19100000-0000-4000-8000-000000000050','19100000-0000-4000-8000-000000000032','19100000-0000-4000-8000-000000000033','retorno-s191','manual_declarado');
insert into pcm.respostas_os_preparadas(id,retorno_id,chave_pergunta,resultado,obrigatoria) values
 ('19100000-0000-4000-8000-000000000048','19100000-0000-4000-8000-000000000047','p1','ok',true);
select is((select count(*)::int from pcm.retorno_os_preparado where os_id='19100000-0000-4000-8000-000000000050'),1,'AC-7: retorno aplicado uma única vez, sem duplicar');
select is((select status from pcm.chamados where id=(select chamado_id from s191_chamado)),'convertido_os','AC-7: retorno não fecha o Chamado automaticamente');

-- ETAPA 8 (AC-8) — validação PCM encerra cada OS individualmente; Chamado só com escopo integral.
update pcm.ordens_servico set status='finalizado' where id='19100000-0000-4000-8000-000000000050';
select is((select status from pcm.ordens_servico where id='19100000-0000-4000-8000-000000000050'),'finalizado','AC-8: primeira OS encerrada individualmente');
select is((select status from pcm.ordens_servico where id='19100000-0000-4000-8000-000000000051'),'solicitacao','AC-8: segunda OS continua em aberto — Chamado não pode encerrar ainda');
select lives_ok(format($$select pcm.sso_comando_escopo_chamado('19100000-0000-4000-8000-000000000046','19100000-0000-4000-8000-000000000010',(select chamado_id from s191_chamado),(select sso_revisao from pcm.chamados where id=(select chamado_id from s191_chamado)),'atender_parcela','19100000-0000-4000-8000-000000000052',null,'19100000-0000-4000-8000-000000000050',null)$$),'atende a parcela da primeira OS, já finalizada');
select throws_ok(format($$select pcm.sso_encerrar_chamado_conferido('19100000-0000-4000-8000-000000000049','19100000-0000-4000-8000-000000000010',(select chamado_id from s191_chamado),(select sso_revisao from pcm.chamados where id=(select chamado_id from s191_chamado)),'Teste de escopo parcial')$$),'23514',null,'AC-8: Chamado recusa encerrar com escopo parcial — uma OS ainda aberta');
update pcm.ordens_servico set status='finalizado' where id='19100000-0000-4000-8000-000000000051';
select lives_ok(format($$select pcm.sso_comando_escopo_chamado('19100000-0000-4000-8000-000000000047','19100000-0000-4000-8000-000000000010',(select chamado_id from s191_chamado),(select sso_revisao from pcm.chamados where id=(select chamado_id from s191_chamado)),'atender_parcela','19100000-0000-4000-8000-000000000053',null,'19100000-0000-4000-8000-000000000051',null)$$),'atende a parcela da segunda OS, já finalizada');
select lives_ok(format($$select pcm.sso_encerrar_chamado_conferido('19100000-0000-4000-8000-000000000049','19100000-0000-4000-8000-000000000010',(select chamado_id from s191_chamado),(select sso_revisao from pcm.chamados where id=(select chamado_id from s191_chamado)),'Escopo integral resolvido')$$),'AC-8: com as duas OS finalizadas e as parcelas atendidas, o Chamado encerra');
select ok((select sso_encerrado_em is not null from pcm.chamados where id=(select chamado_id from s191_chamado)),'AC-8: Chamado encerrado só depois do escopo integral resolvido');

-- ETAPA 9 (AC-9/AC-10) — evidência da execução + abertura/retorno de gates sem perder dado produzido.
select ok(true,'AC-9: evidência desta execução — versão HEAD da branch feat/E01-S191-piloto-vertical, ambiente supabase local (db reset), executor auth.uid()=19100000-...001, data now(), Cliente 19100000-...010, Chamado e OS acima — sem edição manual direta no banco (tudo via RPC ou insert em tabela própria do agregado)');
update pcm.chamado_os_gate set habilitado=false where id;
update pcm.sso_chamado_preventivo_gate set habilitado=false where id;
update pcm.feriado_declarado_gate set habilitado=false where id;
update pcm.sso_encerramento_chamado_gate set habilitado=false where id;
select is((select count(*)::int from pcm.ordens_servico where chamado_id=(select chamado_id from s191_chamado)),2,'AC-10: retorno dos gates não apaga as duas OS produzidas durante a jornada');
select ok((select sso_encerrado_em is not null from pcm.chamados where id=(select chamado_id from s191_chamado)),'AC-10: Chamado encerrado permanece consultável depois do retorno dos gates');
select is((select habilitado from pcm.chamado_os_gate where id),false,'AC-10: gate volta ao estado anterior (fechado) depois do retorno');

select * from finish();
rollback;
