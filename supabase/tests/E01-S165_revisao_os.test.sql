-- S165 AC-5: fotografia parcial de OS aberta comprovadamente ligada à ocorrência.
-- O diagnóstico é informativo; não autoriza aprovação nem declara ausência de impacto.
begin;
set local app.auvo_sync_write = 'true';
select plan(28);

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at) values
  ('16583000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'gestor-impacto-s165@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios(user_id, papel, nome, ativo)
  values ('16583000-0000-4000-8000-000000000001', 'superadmin', 'Gestor de impacto S165', true);
insert into pcm.clientes(id, nome, ativo, created_by)
  values ('16583000-0000-4000-8000-00000000000a', 'Cliente impacto S165', true, '16583000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id, acao, cliente_id)
  values ('16583000-0000-4000-8000-000000000001', 'plano.gerir', '16583000-0000-4000-8000-00000000000a');
insert into pcm.sistemas(id, cliente_id, nome)
  values ('16583000-0000-4000-8000-000000000051', '16583000-0000-4000-8000-00000000000a', 'Sistema com OS S165');
insert into pcm.questionarios(id, auvo_id, nome, perguntas, ativo)
  values ('16583000-0000-4000-8000-000000000061', 1658300061, 'Questionário S165', '[]'::jsonb, true);
insert into pcm.tipos_tarefa(id, nome, ativo, created_by)
  values ('16583000-0000-4000-8000-000000000062', 'Tarefa S165', true, '16583000-0000-4000-8000-000000000001');

set local request.jwt.claims = '{"sub":"16583000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select lives_ok($$ select pcm.sso_salvar_plano_rascunho('16583000-0000-4000-8000-000000000101', 0,
  '16583000-0000-4000-8000-000000000011', '16583000-0000-4000-8000-00000000000a', 'Plano S165 com OS') $$,
  'gestor cria plano para revisão');
select lives_ok($$ select pcm.sso_adicionar_rotina_rascunho_v2('16583000-0000-4000-8000-000000000102', 1,
  '16583000-0000-4000-8000-000000000011', '16583000-0000-4000-8000-000000000031', 'Rotina S165', 'sistema',
  '16583000-0000-4000-8000-000000000051', 'calendario', 1, 'meses', current_date, 30, 0, 0,
  'Inspecionar', null, 'total') $$, 'gestor cria rotina revisável');
select lives_ok($$ select pcm.sso_transicionar_revisao_plano('16583000-0000-4000-8000-000000000103', 2,
  '16583000-0000-4000-8000-000000000011', 'submeter') $$, 'gestor submete plano');
select lives_ok($$ select pcm.sso_aprovar_plano('16583000-0000-4000-8000-000000000104', 3,
  '16583000-0000-4000-8000-000000000011', current_date) $$, 'criador autorizado aprova plano com snapshot');
reset role;
create temporary table s165_versao_aprovada as
  select id as versao_id from pcm.plano_versoes
  where plano_id = '16583000-0000-4000-8000-000000000011' and estado = 'aprovado';
set local role authenticated;
select lives_ok($$ select pcm.sso_iniciar_revisao_plano('16583000-0000-4000-8000-000000000105', 4,
  '16583000-0000-4000-8000-000000000011', '16583000-0000-4000-8000-000000000082') $$,
  'gestor cria rascunho para comparar ocorrência e aprovação');
select throws_ok($$ select pcm.sso_diagnosticar_os_revisao_mediado('16583000-0000-4000-8000-000000000001',
  '16583000-0000-4000-8000-00000000000a', '16583000-0000-4000-8000-000000000011', 5) $$,
  '55000', null, 'fotografia de OS exige gates explícitos');
reset role;

insert into pcm.ocorrencias_rotina_preparadas(id, plano_id, versao_id, rotina_id, rotina_logica_id,
  alvo_tipo, alvo_id, ciclo, vencimento_original, tolerancia_antes, tolerancia_depois, created_by)
select '16583000-0000-4000-8000-000000000071', p.id, v.id, r.id, r.rotina_logica_id,
  r.alvo_tipo, r.sistema_id, 0, current_date, 0, 0, '16583000-0000-4000-8000-000000000001'
from pcm.planos_manutencao p
join s165_versao_aprovada va on true
join pcm.plano_versoes v on v.id = va.versao_id and v.plano_id = p.id
join pcm.rotinas_manutencao r on r.versao_id = v.id
where p.id = '16583000-0000-4000-8000-000000000011';
insert into pcm.ocorrencias_rotina_preparadas(id, plano_id, versao_id, rotina_id, rotina_logica_id,
  alvo_tipo, alvo_id, ciclo, vencimento_original, tolerancia_antes, tolerancia_depois, created_by)
select '16583000-0000-4000-8000-000000000076', p.id, v.id, r.id, r.rotina_logica_id,
  r.alvo_tipo, r.sistema_id, 1, (current_date + interval '1 month')::date, 0, 0, '16583000-0000-4000-8000-000000000001'
from pcm.planos_manutencao p
join s165_versao_aprovada va on true
join pcm.plano_versoes v on v.id = va.versao_id and v.plano_id = p.id
join pcm.rotinas_manutencao r on r.versao_id = v.id
where p.id = '16583000-0000-4000-8000-000000000011';
insert into pcm.ciclos_rotina_identidades(id, rotina_logica_id, alvo_tipo, alvo_id, created_by)
  values ('16583000-0000-4000-8000-000000000072', '16583000-0000-4000-8000-000000000031',
    'sistema', '16583000-0000-4000-8000-000000000051', '16583000-0000-4000-8000-000000000001');
insert into pcm.planos_preventivos(id, cliente_id, sistema_id, questionario_id, tipo_tarefa_id, nome,
  primeira_data, intervalo_unidade, intervalo_n, estado, created_by)
  values ('16583000-0000-4000-8000-000000000073', '16583000-0000-4000-8000-00000000000a',
    '16583000-0000-4000-8000-000000000051', '16583000-0000-4000-8000-000000000061',
    '16583000-0000-4000-8000-000000000062', 'Plano legado S165', current_date, 'meses', 1, 'ativo',
    '16583000-0000-4000-8000-000000000001');
insert into pcm.ocorrencias_preventivas(id, plano_id, indice, vencimento, chave_externa)
  values ('16583000-0000-4000-8000-000000000074', '16583000-0000-4000-8000-000000000073', 1,
    current_date, 'S165-REVISAO-OS-16583000');
insert into pcm.ocorrencias_rotina_vinculos(ocorrencia_preparada_id, ciclo_id, ocorrencia_legada_id, created_by)
  values ('16583000-0000-4000-8000-000000000071', '16583000-0000-4000-8000-000000000072',
    '16583000-0000-4000-8000-000000000074', '16583000-0000-4000-8000-000000000001');
insert into pcm.ordens_servico(id, client_id, numero, titulo, categoria, status, prioridade, origem,
  created_by, ocorrencia_preventiva_id)
  values ('16583000-0000-4000-8000-000000000075', '16583000-0000-4000-8000-00000000000a',
    'OS-S165-REVISAO', 'OS aberta ligada à rotina', 'preventiva', 'em_execucao', 'media', 'manual',
    '16583000-0000-4000-8000-000000000001', '16583000-0000-4000-8000-000000000074');
update pcm.sso_diagnostico_revisao_mediado_gate set habilitado = true where id;
update pcm.sso_impacto_revisao_os_gate set habilitado = true where id;

set local role authenticated;
select is((pcm.sso_diagnosticar_os_revisao_mediado('16583000-0000-4000-8000-000000000001',
  '16583000-0000-4000-8000-00000000000a', '16583000-0000-4000-8000-000000000011', 5)->>'osVinculadasMesmoCliente')::integer,
  1, 'diagnóstico encontra OS vinculada ao ciclo revisado');
select is((pcm.sso_diagnosticar_os_revisao_mediado('16583000-0000-4000-8000-000000000001',
  '16583000-0000-4000-8000-00000000000a', '16583000-0000-4000-8000-000000000011', 5)->>'osAbertasMesmoCliente')::integer,
  1, 'diagnóstico identifica OS ainda aberta');
select is((pcm.sso_diagnosticar_os_revisao_mediado('16583000-0000-4000-8000-000000000001',
  '16583000-0000-4000-8000-00000000000a', '16583000-0000-4000-8000-000000000011', 5)->>'osClienteDivergente')::integer,
  0, 'diagnóstico separa OS de outro Cliente');
select is((pcm.sso_diagnosticar_os_revisao_mediado('16583000-0000-4000-8000-000000000001',
  '16583000-0000-4000-8000-00000000000a', '16583000-0000-4000-8000-000000000011', 5)->>'impactoOperacionalCalculado')::boolean,
  false, 'fotografia parcial não declara impacto calculado');
select is((pcm.sso_diagnosticar_os_revisao_mediado('16583000-0000-4000-8000-000000000001',
  '16583000-0000-4000-8000-00000000000a', '16583000-0000-4000-8000-000000000011', 5)->>'ausenciaDeImpactoComprovada')::boolean,
  false, 'fotografia parcial não declara ausência de impacto');
select is((select count(*)::integer from pcm.sso_listar_os_revisao_mediada('16583000-0000-4000-8000-000000000001',
  '16583000-0000-4000-8000-00000000000a', '16583000-0000-4000-8000-000000000011', 5, null, 20)),
  1, 'lista mostra OS abertas ligadas por ponte comprovada');
select is((select status from pcm.sso_listar_os_revisao_mediada('16583000-0000-4000-8000-000000000001',
  '16583000-0000-4000-8000-00000000000a', '16583000-0000-4000-8000-000000000011', 5, null, 20)),
  'em_execucao', 'lista preserva estado operacional da OS');
select is((select count(*)::integer from pcm.sso_listar_os_revisao_mediada('16583000-0000-4000-8000-000000000001',
  '16583000-0000-4000-8000-00000000000a', '16583000-0000-4000-8000-000000000011', 5,
  '16583000-0000-4000-8000-000000000075', 20)), 0, 'cursor não repete OS já consultada');
select throws_ok($$ select pcm.sso_diagnosticar_os_revisao_mediado('16583000-0000-4000-8000-000000000001',
  '16583000-0000-4000-8000-00000000000a', '16583000-0000-4000-8000-000000000011', 4) $$,
  'P0011', null, 'diagnóstico recusa revisão obsoleta');
select is((pcm.sso_recibo_reconciliacao_revisao_mediado('16583000-0000-4000-8000-000000000001',
  '16583000-0000-4000-8000-00000000000a', '16583000-0000-4000-8000-000000000011', 5, current_date + 30, null, 20)->>'ocorrenciasObservadas')::integer,
  2, 'recibo pagina todas as ocorrências preparadas na versão anterior');
select ok((pcm.sso_recibo_reconciliacao_revisao_mediado('16583000-0000-4000-8000-000000000001',
  '16583000-0000-4000-8000-00000000000a', '16583000-0000-4000-8000-000000000011', 5, current_date + 30, null, 1)->>'nextCursor') is not null,
  'recibo informa cursor quando existem páginas seguintes');
select is(jsonb_array_length((pcm.sso_recibo_reconciliacao_revisao_mediado('16583000-0000-4000-8000-000000000001',
  '16583000-0000-4000-8000-00000000000a', '16583000-0000-4000-8000-000000000011', 5, current_date + 30,
  (pcm.sso_recibo_reconciliacao_revisao_mediado('16583000-0000-4000-8000-000000000001',
    '16583000-0000-4000-8000-00000000000a', '16583000-0000-4000-8000-000000000011', 5, current_date + 30, null, 1)->>'nextCursor'),1)->'ocorrencias')),
  1, 'cursor continua sem repetir ocorrência entre páginas');
select is((pcm.sso_recibo_reconciliacao_revisao_mediado('16583000-0000-4000-8000-000000000001',
  '16583000-0000-4000-8000-00000000000a', '16583000-0000-4000-8000-000000000011', 5, current_date + 30, null, 20)->>'aManter')::integer,
  2, 'recibo pareia ocorrências inalteradas por rotina lógica, alvo e ciclo/data');
select is((pcm.sso_recibo_reconciliacao_revisao_mediado('16583000-0000-4000-8000-000000000001',
  '16583000-0000-4000-8000-00000000000a', '16583000-0000-4000-8000-000000000011', 5, current_date + 30, null, 20)->>'osAbertasComPonteComprovada')::integer,
  1, 'recibo lista OS aberta apenas pela ponte existente');
select is((pcm.sso_recibo_reconciliacao_revisao_mediado('16583000-0000-4000-8000-000000000001',
  '16583000-0000-4000-8000-00000000000a', '16583000-0000-4000-8000-000000000011', 5, current_date + 30, null, 20)->>'comFontesDesconhecidas')::integer,
  1, 'ocorrência sem ponte permanece explicitamente desconhecida');
select is((pcm.sso_recibo_reconciliacao_revisao_mediado('16583000-0000-4000-8000-000000000001',
  '16583000-0000-4000-8000-00000000000a', '16583000-0000-4000-8000-000000000011', 5, current_date + 30, null, 20)->>'confirmacaoBloqueada')::boolean,
  true, 'recibo bloqueia confirmação com fontes incompletas');
select is((pcm.sso_recibo_reconciliacao_revisao_mediado('16583000-0000-4000-8000-000000000001',
  '16583000-0000-4000-8000-00000000000a', '16583000-0000-4000-8000-000000000011', 5, current_date + 30, null, 20)->>'aprovacaoAutorizada')::boolean,
  false, 'recibo nunca autoriza aprovação');
select is((select status from pcm.ordens_servico where id = '16583000-0000-4000-8000-000000000075'),
  'em_execucao', 'consulta de impacto não altera nem cancela OS aberta');
select lives_ok($$ select pcm.sso_editar_rotina_rascunho_v2('16583000-0000-4000-8000-000000000106', 5,
  '16583000-0000-4000-8000-000000000011',
  (select r.id from pcm.rotinas_manutencao r join pcm.plano_versoes v on v.id = r.versao_id
    where r.plano_id = '16583000-0000-4000-8000-000000000011' and v.estado = 'rascunho'),
  'Rotina S165 alterada', 'sistema', '16583000-0000-4000-8000-000000000051', 'calendario', 1, 'meses',
  current_date + 2, 30, 0, 0, 'Inspecionar', null, 'total') $$,
  'gestor altera a data-base na revisão em rascunho');
select is((pcm.sso_recibo_reconciliacao_revisao_mediado('16583000-0000-4000-8000-000000000001',
  '16583000-0000-4000-8000-00000000000a', '16583000-0000-4000-8000-000000000011', 6, current_date + 30, null, 20)->>'aAlterar')::integer,
  2, 'recibo classifica como alterar as ocorrências cuja data-base mudou');
select lives_ok($$ select pcm.sso_retirar_rotina_rascunho('16583000-0000-4000-8000-000000000107', 6,
  '16583000-0000-4000-8000-000000000011',
  (select r.id from pcm.rotinas_manutencao r join pcm.plano_versoes v on v.id = r.versao_id
    where r.plano_id = '16583000-0000-4000-8000-000000000011' and v.estado = 'rascunho'),
  'Retirada de escopo para validar classificação') $$,
  'gestor retira a rotina da revisão em rascunho');
select is((pcm.sso_recibo_reconciliacao_revisao_mediado('16583000-0000-4000-8000-000000000001',
  '16583000-0000-4000-8000-00000000000a', '16583000-0000-4000-8000-000000000011', 7, current_date + 30, null, 20)->>'aRetirar')::integer,
  2, 'recibo classifica como retirar as ocorrências da rotina removida');
reset role;
select * from finish();
rollback;
