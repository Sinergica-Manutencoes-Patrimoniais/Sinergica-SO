-- E01-S194 AC-7/AC-8/AC-10 — fn_operacao_alterar_status_lote exige execucao.validar pra entrar em
-- finalizado; aceita o novo status validacao_pcm; mapeamento Auvo→validacao_pcm fica coberto nos
-- testes Deno de pcm-auvo-webhook/pcm-auvo-tasks-import (mesma story), não repetido aqui.
begin;
set local app.auvo_sync_write = 'true';
select plan(25);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('19400000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s194-validador@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now()),
 ('19400000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s194-sem-validar@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values
 ('19400000-0000-4000-8000-000000000001','superadmin','Validador S194',true),
 ('19400000-0000-4000-8000-000000000002','colaborador','Sem validar S194',true);
insert into pcm.clientes(id,nome,ativo,created_by) values ('19400000-0000-4000-8000-000000000010','[TESTE] Cliente S194',true,'19400000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('19400000-0000-4000-8000-000000000001','execucao.validar','19400000-0000-4000-8000-000000000010');
-- "Sem validar" tem módulo pcm (escrita) mas nenhuma concessão de execucao.validar — prova que
-- módulo sozinho não basta, mesmo achado da E01-S170/E00-S26/E00-S27.
insert into config.sso_perfis(id,nome,ativo) values ('19400000-0000-4000-8000-000000000030','Perfil PCM escrita S194',true);
insert into config.sso_concessoes(perfil_id,acao,cliente_id) values ('19400000-0000-4000-8000-000000000030','cadastro.gerir','19400000-0000-4000-8000-000000000010');
insert into config.sso_usuario_perfis(usuario_id,perfil_id,ativo) values ('19400000-0000-4000-8000-000000000002','19400000-0000-4000-8000-000000000030',true);

insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,status,created_by) values
 ('19400000-0000-4000-8000-000000000021','19400000-0000-4000-8000-000000000010','OS-S194-A','Em execução','corretiva','em_execucao','19400000-0000-4000-8000-000000000001'),
 ('19400000-0000-4000-8000-000000000022','19400000-0000-4000-8000-000000000010','OS-S194-B','Em execução','corretiva','em_execucao','19400000-0000-4000-8000-000000000001'),
 ('19400000-0000-4000-8000-000000000023','19400000-0000-4000-8000-000000000010','OS-S194-C','Solicitação','corretiva','solicitacao','19400000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"19400000-0000-4000-8000-000000000002","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}',true);

select is(
  (select sucesso from pcm.fn_operacao_alterar_status_lote(array['19400000-0000-4000-8000-000000000021'::uuid],'validacao_pcm')),
  true,
  'AC-7/AC-8: qualquer usuário com acesso à OS pode mover para validacao_pcm (não é a transição sensível)'
);
select is(
  (select status from pcm.ordens_servico where id='19400000-0000-4000-8000-000000000021'),
  'validacao_pcm',
  'validacao_pcm persiste como status real da OS'
);

select is(
  (select sucesso from pcm.fn_operacao_alterar_status_lote(array['19400000-0000-4000-8000-000000000021'::uuid],'finalizado')),
  false,
  'AC-10: usuário sem execucao.validar é recusado ao tentar finalizar — mesmo já tendo módulo pcm'
);
select is(
  (select erro from pcm.fn_operacao_alterar_status_lote(array['19400000-0000-4000-8000-000000000021'::uuid],'finalizado')),
  'sem_acesso',
  'erro nomeado, não genérico'
);
select is(
  (select status from pcm.ordens_servico where id='19400000-0000-4000-8000-000000000021'),
  'validacao_pcm',
  'OS permanece em validacao_pcm — a recusa não deixa estado parcial'
);

select set_config('request.jwt.claims','{"sub":"19400000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);

select is(
  (select sucesso from pcm.fn_operacao_alterar_status_lote(array['19400000-0000-4000-8000-000000000021'::uuid],'finalizado')),
  true,
  'AC-10: usuário com execucao.validar finaliza normalmente'
);
select is(
  (select status from pcm.ordens_servico where id='19400000-0000-4000-8000-000000000021'),
  'finalizado',
  'finalizado persiste quando autorizado'
);

select is(
  (select sucesso from pcm.fn_operacao_alterar_status_lote(array['19400000-0000-4000-8000-000000000021'::uuid],'planejamento')),
  false, 'Finalizada exige reabertura pelo fluxo próprio'
);
select is(
  (select sucesso from pcm.fn_operacao_alterar_status_lote(array['19400000-0000-4000-8000-000000000022'::uuid],'finalizado')),
  false, 'Execução não pode saltar a Validação PCM mesmo com capacidade'
);
select is(
  (select sucesso from pcm.fn_operacao_alterar_status_lote(array['19400000-0000-4000-8000-000000000022'::uuid],'validacao_pcm')),
  true, 'Contrato manual vigente permite ingresso a partir de execução'
);
select is(
  (select sucesso from pcm.fn_operacao_alterar_status_lote(array['19400000-0000-4000-8000-000000000022'::uuid],'em_execucao')),
  true, 'PCM pode devolver OS para execução'
);

select is(
  (select sucesso from pcm.fn_operacao_alterar_status_lote(array['19400000-0000-4000-8000-000000000023'::uuid],'validacao_pcm')),
  false, 'Solicitação não pode saltar para Validação PCM'
);
select is(
  (select sucesso from pcm.fn_operacao_alterar_status_lote(array['19400000-0000-4000-8000-000000000023'::uuid],'planejamento')),
  true, 'Solicitação pode avançar para Planejamento'
);
select is(
  (select sucesso from pcm.fn_operacao_alterar_status_lote(array['19400000-0000-4000-8000-000000000023'::uuid],'validacao_pcm')),
  false, 'Origem persistida em Planejamento impede salto com tela desatualizada'
);

reset role;

-- Simula a escrita que o importador emite após mapear uma tarefa concluída.
update pcm.ordens_servico set status = 'validacao_pcm'
where id = '19400000-0000-4000-8000-000000000022';
select is(
  (select status from pcm.ordens_servico where id='19400000-0000-4000-8000-000000000022'),
  'validacao_pcm', 'Escrita de conclusão sintética do campo continua disponível fora do RPC manual'
);

select throws_ok(
  $$select pcm.fn_operacao_alterar_status_lote(array['19400000-0000-4000-8000-000000000022'::uuid],'nao_existe')$$,
  '22023',
  null,
  'status fora da whitelist continua recusado (regressão contra a correção desta story)'
);
select throws_ok(
  $$select pcm.fn_operacao_alterar_status_lote(array['19400000-0000-4000-8000-000000000022'::uuid],null)$$,
  '22023',
  null,
  'achado de revisão: status null é recusado, não grava NULL na OS (bug pré-existente em 0178)'
);

-- AC-4/AC-9: fecha o dead-end que a própria E01-S193 (migration 1854) deixou documentado —
-- Chamado em 'demanda' não conseguia virar OS porque sso_criar_os_chamado só aceitava
-- 'aberto'/'convertido_os'. Prova também que a OS nasce em 'planejamento' (não 'solicitacao' —
-- já passou da triagem) e que o caminho 'aberto' original não muda (ensaio multiplas-os já cobre).
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('19400000-0000-4000-8000-000000000001','chamado.os.criar','19400000-0000-4000-8000-000000000010');
insert into pcm.chamados(id,numero,cliente_id,titulo,origem,status,created_by) values
 ('19400000-0000-4000-8000-000000000040','CH-TESTE-S194-DEMANDA','19400000-0000-4000-8000-000000000010','Chamado em demanda','manual','demanda','19400000-0000-4000-8000-000000000001');
update pcm.sso_criacao_os_mediada_gate set habilitado=true where id;
update pcm.chamado_os_gate set habilitado=true where id;

select is(
  pcm.sso_criar_os_chamado_autorizado('19400000-0000-4000-8000-000000000041',1,'19400000-0000-4000-8000-000000000040','19400000-0000-4000-8000-000000000010','19400000-0000-4000-8000-000000000042','OS da demanda',null,'corretiva')->>'osId',
  '19400000-0000-4000-8000-000000000042',
  'AC-4/AC-9: Chamado em demanda cria OS — dead-end da E01-S193 fechado'
);
select is(
  (select status from pcm.ordens_servico where id='19400000-0000-4000-8000-000000000042'),
  'planejamento',
  'AC-4/AC-9: OS nasce em planejamento, não solicitacao — o Chamado já passou da triagem'
);
select is(
  (select status from pcm.chamados where id='19400000-0000-4000-8000-000000000040'),
  'convertido_os',
  'Chamado transiciona pra convertido_os, mesmo padrão do caminho aberto→convertido_os'
);

-- O importador grava a fase derivada da conclusão sintética. O Chamado vinculado segue aberto
-- para operação, no estado convertido_os, mesmo após receber a fase de Validação PCM.
update pcm.ordens_servico set status = 'validacao_pcm'
where id = '19400000-0000-4000-8000-000000000042';
select is(
  (select status from pcm.ordens_servico where id='19400000-0000-4000-8000-000000000042'),
  'validacao_pcm', 'Conclusão sintética chega à Validação PCM na OS vinculada'
);
select is(
  (select status from pcm.chamados where id='19400000-0000-4000-8000-000000000040'),
  'convertido_os', 'Conclusão sintética preserva o Chamado aberto para operação'
);

-- AC-1/AC-4: Chamado em demanda SEM OS ainda aparece no Kanban como card sintético — mesmo
-- padrão do 'chamado-aberto:' (1509), view só estendida pra incluir status='demanda'.
insert into pcm.chamados(id,numero,cliente_id,titulo,origem,status,created_by) values
 ('19400000-0000-4000-8000-000000000050','CH-TESTE-S194-SEM-OS','19400000-0000-4000-8000-000000000010','Chamado demanda sem OS','manual','demanda','19400000-0000-4000-8000-000000000001');
select is(
  (select item_tipo from pcm.operacao_itens where item_id='chamado-aberto:19400000-0000-4000-8000-000000000050'),
  'chamado_aberto',
  'AC-1/AC-4: Chamado em demanda sem OS vira card sintético, mesmo padrão do chamado-aberto'
);
select is(
  (select status from pcm.operacao_itens where item_id='chamado-aberto:19400000-0000-4000-8000-000000000050'),
  'demanda',
  'AC-1: o card sintético carrega o status real do Chamado (demanda), não mais sempre solicitacao'
);

-- Os 3 agregados (sso_resumir_chamados_lote, sso_listar_chamados_gerenciais[_v2]) são gated e
-- fortemente autorizados demais para exercitar fim a fim aqui sem reconstruir todo o fixture da
-- E01-S167 — a prova direta é que o `create or replace` incluiu 'validacao_pcm' na whitelist de
-- cada um (sem isso, um Chamado com OS em validacao_pcm nunca seria sinalizado como "mistas").
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'pcm' and p.proname in ('sso_resumir_chamados_lote','sso_listar_chamados_gerenciais','sso_listar_chamados_gerenciais_v2')
      and pg_get_functiondef(p.oid) like '%validacao_pcm%'),
  3,
  'os 3 agregados de etapas_mistas incluem validacao_pcm na whitelist — sem falso negativo silencioso'
);

select * from finish();
rollback;
