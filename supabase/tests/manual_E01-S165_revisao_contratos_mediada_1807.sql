-- Apenas clone descartável, migrations até 1807, psql ON_ERROR_STOP; tudo revertido.
-- Anti-loop Auvo é ativado no setup sintético; não comprova outbox nem concorrência.
-- Apenas clone sintético descartável com migrations até 1804; psql ON_ERROR_STOP.
-- Nenhuma guarda é desabilitada. O gate da borda nova é habilitado só nesta transação.
begin;
set local app.auvo_sync_write = 'true';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('18040000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','aprovacao-inicial-1804@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo)
values ('18040000-0000-4000-8000-000000000001','superadmin','Aprovação inicial sintética',true);
insert into pcm.clientes(id,nome,ativo,created_by)
values ('18040000-0000-4000-8000-00000000000a','Cliente sintético',true,'18040000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id)
values ('18040000-0000-4000-8000-000000000001','plano.gerir','18040000-0000-4000-8000-00000000000a');
insert into pcm.sistemas(id,cliente_id,nome)
values ('18040000-0000-4000-8000-000000000051','18040000-0000-4000-8000-00000000000a','Sistema sintético');
update pcm.sso_aprovacao_versao_esperada_gate set habilitado=true where id;
update pcm.sso_exigir_versao_aprovacao_gate set habilitado=false where id;
set local request.jwt.claims = '{"sub":"18040000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

do $$
declare
  v_plano constant uuid := '18040000-0000-4000-8000-000000000011';
  v_cliente constant uuid := '18040000-0000-4000-8000-00000000000a';
  v_ator constant uuid := '18040000-0000-4000-8000-000000000001';
  v_pedido constant uuid := '18040000-0000-4000-8000-000000000114';
  v_criacao jsonb; v_rotina jsonb; v_transicao jsonb; v_previa jsonb;
  v_versao uuid; v_recibo jsonb; v_repetido jsonb; v_legado jsonb;
begin
  v_criacao := pcm.sso_salvar_plano_rascunho('18040000-0000-4000-8000-000000000111',0,v_plano,v_cliente,'Plano inicial sintético');
  if (v_criacao->>'revision')::integer <> 1 then raise exception 'criacao_divergente'; end if;
  v_rotina := pcm.sso_adicionar_rotina_rascunho_v2('18040000-0000-4000-8000-000000000112',1,v_plano,
    '18040000-0000-4000-8000-000000000081','Rotina mensal','sistema','18040000-0000-4000-8000-000000000051',
    'calendario',1,'meses',current_date,30,0,0,'Inspecionar',null,'total');
  if (v_rotina->>'revision')::integer <> 2 then raise exception 'rotina_divergente'; end if;
  v_versao := (v_rotina->'linkedIds'->>'versaoId')::uuid;
  v_transicao := pcm.sso_transicionar_revisao_plano('18040000-0000-4000-8000-000000000113',2,v_plano,'submeter');
  if (v_transicao->>'revision')::integer <> 3 then raise exception 'submissao_divergente'; end if;
  v_previa := pcm.sso_preparar_aprovacao_versao(v_ator,v_cliente,v_plano,3);
  if v_previa->>'versaoId' is distinct from v_versao::text then raise exception 'previa_divergente'; end if;

  v_recibo := pcm.sso_aprovar_versao_esperada(v_ator,v_cliente,v_pedido,3,v_plano,v_versao,current_date,false);
  if v_recibo->>'state' is distinct from 'aprovado' then raise exception 'setup_aprovacao_incorreta'; end if;
end $$;
do $$
declare
  v_plano constant uuid := '18040000-0000-4000-8000-000000000012';
  v_cliente constant uuid := '18040000-0000-4000-8000-00000000000a';
  v_ator constant uuid := '18040000-0000-4000-8000-000000000001';
  v_pedido constant uuid := '18040000-0000-4000-8000-000000000124';
  v_criacao jsonb; v_rotina jsonb; v_transicao jsonb; v_previa jsonb;
  v_versao uuid; v_recibo jsonb; v_repetido jsonb; v_legado jsonb;
begin
  v_criacao := pcm.sso_salvar_plano_rascunho('18040000-0000-4000-8000-000000000121',0,v_plano,v_cliente,'Plano inicial sintético');
  if (v_criacao->>'revision')::integer <> 1 then raise exception 'criacao_divergente'; end if;
  v_rotina := pcm.sso_adicionar_rotina_rascunho_v2('18040000-0000-4000-8000-000000000122',1,v_plano,
    '18040000-0000-4000-8000-000000000082','Rotina mensal','sistema','18040000-0000-4000-8000-000000000051',
    'calendario',1,'meses',current_date,30,0,0,'Inspecionar',null,'total');
  if (v_rotina->>'revision')::integer <> 2 then raise exception 'rotina_divergente'; end if;
  v_versao := (v_rotina->'linkedIds'->>'versaoId')::uuid;
  v_transicao := pcm.sso_transicionar_revisao_plano('18040000-0000-4000-8000-000000000123',2,v_plano,'submeter');
  if (v_transicao->>'revision')::integer <> 3 then raise exception 'submissao_divergente'; end if;
  v_previa := pcm.sso_preparar_aprovacao_versao(v_ator,v_cliente,v_plano,3);
  if v_previa->>'versaoId' is distinct from v_versao::text then raise exception 'previa_divergente'; end if;

  v_recibo := pcm.sso_aprovar_versao_esperada(v_ator,v_cliente,v_pedido,3,v_plano,v_versao,current_date,false);
  if v_recibo->>'state' is distinct from 'aprovado' then raise exception 'setup_aprovacao_incorreta'; end if;
end $$;
do $$
declare
  v_plano constant uuid := '18040000-0000-4000-8000-000000000013';
  v_cliente constant uuid := '18040000-0000-4000-8000-00000000000a';
  v_ator constant uuid := '18040000-0000-4000-8000-000000000001';
  v_pedido constant uuid := '18040000-0000-4000-8000-000000000134';
  v_criacao jsonb; v_rotina jsonb; v_transicao jsonb; v_previa jsonb;
  v_versao uuid; v_recibo jsonb; v_repetido jsonb; v_legado jsonb;
begin
  v_criacao := pcm.sso_salvar_plano_rascunho('18040000-0000-4000-8000-000000000131',0,v_plano,v_cliente,'Plano inicial sintético');
  if (v_criacao->>'revision')::integer <> 1 then raise exception 'criacao_divergente'; end if;
  v_rotina := pcm.sso_adicionar_rotina_rascunho_v2('18040000-0000-4000-8000-000000000132',1,v_plano,
    '18040000-0000-4000-8000-000000000083','Rotina mensal','sistema','18040000-0000-4000-8000-000000000051',
    'calendario',1,'meses',current_date,30,0,0,'Inspecionar',null,'total');
  if (v_rotina->>'revision')::integer <> 2 then raise exception 'rotina_divergente'; end if;
  v_versao := (v_rotina->'linkedIds'->>'versaoId')::uuid;
  v_transicao := pcm.sso_transicionar_revisao_plano('18040000-0000-4000-8000-000000000133',2,v_plano,'submeter');
  if (v_transicao->>'revision')::integer <> 3 then raise exception 'submissao_divergente'; end if;
  v_previa := pcm.sso_preparar_aprovacao_versao(v_ator,v_cliente,v_plano,3);
  if v_previa->>'versaoId' is distinct from v_versao::text then raise exception 'previa_divergente'; end if;

  v_recibo := pcm.sso_aprovar_versao_esperada(v_ator,v_cliente,v_pedido,3,v_plano,v_versao,current_date,false);
  if v_recibo->>'state' is distinct from 'aprovado' then raise exception 'setup_aprovacao_incorreta'; end if;
end $$;
do $$
declare
  v_plano constant uuid := '18040000-0000-4000-8000-000000000014';
  v_cliente constant uuid := '18040000-0000-4000-8000-00000000000a';
  v_ator constant uuid := '18040000-0000-4000-8000-000000000001';
  v_pedido constant uuid := '18040000-0000-4000-8000-000000000144';
  v_criacao jsonb; v_rotina jsonb; v_transicao jsonb; v_previa jsonb;
  v_versao uuid; v_recibo jsonb; v_repetido jsonb; v_legado jsonb;
begin
  v_criacao := pcm.sso_salvar_plano_rascunho('18040000-0000-4000-8000-000000000141',0,v_plano,v_cliente,'Plano inicial sintético');
  if (v_criacao->>'revision')::integer <> 1 then raise exception 'criacao_divergente'; end if;
  v_rotina := pcm.sso_adicionar_rotina_rascunho_v2('18040000-0000-4000-8000-000000000142',1,v_plano,
    '18040000-0000-4000-8000-000000000084','Rotina mensal','sistema','18040000-0000-4000-8000-000000000051',
    'calendario',1,'meses',current_date,30,0,0,'Inspecionar',null,'total');
  if (v_rotina->>'revision')::integer <> 2 then raise exception 'rotina_divergente'; end if;
  v_versao := (v_rotina->'linkedIds'->>'versaoId')::uuid;
  v_transicao := pcm.sso_transicionar_revisao_plano('18040000-0000-4000-8000-000000000143',2,v_plano,'submeter');
  if (v_transicao->>'revision')::integer <> 3 then raise exception 'submissao_divergente'; end if;
  v_previa := pcm.sso_preparar_aprovacao_versao(v_ator,v_cliente,v_plano,3);
  if v_previa->>'versaoId' is distinct from v_versao::text then raise exception 'previa_divergente'; end if;

  v_recibo := pcm.sso_aprovar_versao_esperada(v_ator,v_cliente,v_pedido,3,v_plano,v_versao,current_date,false);
  if v_recibo->>'state' is distinct from 'aprovado' then raise exception 'setup_aprovacao_incorreta'; end if;
end $$;
do $$
declare
  v_plano constant uuid := '18040000-0000-4000-8000-000000000015';
  v_cliente constant uuid := '18040000-0000-4000-8000-00000000000a';
  v_ator constant uuid := '18040000-0000-4000-8000-000000000001';
  v_pedido constant uuid := '18040000-0000-4000-8000-000000000154';
  v_criacao jsonb; v_rotina jsonb; v_transicao jsonb; v_previa jsonb;
  v_versao uuid; v_recibo jsonb; v_repetido jsonb; v_legado jsonb;
begin
  v_criacao := pcm.sso_salvar_plano_rascunho('18040000-0000-4000-8000-000000000151',0,v_plano,v_cliente,'Plano inicial sintético');
  if (v_criacao->>'revision')::integer <> 1 then raise exception 'criacao_divergente'; end if;
  v_rotina := pcm.sso_adicionar_rotina_rascunho_v2('18040000-0000-4000-8000-000000000152',1,v_plano,
    '18040000-0000-4000-8000-000000000085','Rotina mensal','sistema','18040000-0000-4000-8000-000000000051',
    'calendario',1,'meses',current_date,30,0,0,'Inspecionar',null,'total');
  if (v_rotina->>'revision')::integer <> 2 then raise exception 'rotina_divergente'; end if;
  v_versao := (v_rotina->'linkedIds'->>'versaoId')::uuid;
  v_transicao := pcm.sso_transicionar_revisao_plano('18040000-0000-4000-8000-000000000153',2,v_plano,'submeter');
  if (v_transicao->>'revision')::integer <> 3 then raise exception 'submissao_divergente'; end if;
  v_previa := pcm.sso_preparar_aprovacao_versao(v_ator,v_cliente,v_plano,3);
  if v_previa->>'versaoId' is distinct from v_versao::text then raise exception 'previa_divergente'; end if;

  v_recibo := pcm.sso_aprovar_versao_esperada(v_ator,v_cliente,v_pedido,3,v_plano,v_versao,current_date,false);
  if v_recibo->>'state' is distinct from 'aprovado' then raise exception 'setup_aprovacao_incorreta'; end if;
end $$;
do $$
declare
  v_plano constant uuid := '18040000-0000-4000-8000-000000000016';
  v_cliente constant uuid := '18040000-0000-4000-8000-00000000000a';
  v_ator constant uuid := '18040000-0000-4000-8000-000000000001';
  v_pedido constant uuid := '18040000-0000-4000-8000-000000000164';
  v_criacao jsonb; v_rotina jsonb; v_transicao jsonb; v_previa jsonb;
  v_versao uuid; v_recibo jsonb; v_repetido jsonb; v_legado jsonb;
begin
  v_criacao := pcm.sso_salvar_plano_rascunho('18040000-0000-4000-8000-000000000161',0,v_plano,v_cliente,'Plano inicial sintético');
  if (v_criacao->>'revision')::integer <> 1 then raise exception 'criacao_divergente'; end if;
  v_rotina := pcm.sso_adicionar_rotina_rascunho_v2('18040000-0000-4000-8000-000000000162',1,v_plano,
    '18040000-0000-4000-8000-000000000086','Rotina mensal','sistema','18040000-0000-4000-8000-000000000051',
    'calendario',1,'meses',current_date,30,0,0,'Inspecionar',null,'total');
  if (v_rotina->>'revision')::integer <> 2 then raise exception 'rotina_divergente'; end if;
  v_versao := (v_rotina->'linkedIds'->>'versaoId')::uuid;
  v_transicao := pcm.sso_transicionar_revisao_plano('18040000-0000-4000-8000-000000000163',2,v_plano,'submeter');
  if (v_transicao->>'revision')::integer <> 3 then raise exception 'submissao_divergente'; end if;
  v_previa := pcm.sso_preparar_aprovacao_versao(v_ator,v_cliente,v_plano,3);
  if v_previa->>'versaoId' is distinct from v_versao::text then raise exception 'previa_divergente'; end if;

  v_recibo := pcm.sso_aprovar_versao_esperada(v_ator,v_cliente,v_pedido,3,v_plano,v_versao,current_date,false);
  if v_recibo->>'state' is distinct from 'aprovado' then raise exception 'setup_aprovacao_incorreta'; end if;
end $$;
-- Gate novo desligado por padrão deve impedir chamada mediada.
do $$ begin
 begin
  perform pcm.sso_iniciar_revisao_contratos_mediada('18040000-0000-4000-8000-000000000001','18040000-0000-4000-8000-00000000000a','18040000-0000-4000-8000-000000000011','18070000-0000-4000-8000-000000000001',4,'18070001-0000-4000-8000-000000000001','contratos');
  raise exception 'gate_1807_nao_bloqueou';
 exception when object_not_in_prerequisite_state then
  if sqlerrm <> 'operacao_desabilitada' then raise; end if;
 end;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','pcm.sso_iniciar_revisao_contratos_mediada(uuid,uuid,uuid,uuid,integer,uuid,text)','EXECUTE') then raise exception 'acl_anon_divergente'; end if;
end $$;
update pcm.sso_inicio_revisao_contratos_mediado_gate set habilitado=true where id;
update pcm.sso_revisao_contrato_gate set habilitado=true where id;
update pcm.sso_contrato_pergunta_gate set habilitado=true where id;
update pcm.sso_revisao_evidencia_gate set habilitado=true where id;
update pcm.sso_contrato_evidencia_gate set habilitado=true where id;
update pcm.sso_revisao_exigencias_gate set habilitado=true where id;
update pcm.sso_exigencia_legal_gate set habilitado=true where id;
update pcm.sso_contratos_em_revisao_gate set habilitado=true where id;
create temp table sso_1807_recibos(modo text primary key, resultado jsonb) on commit drop;
grant select on pg_temp.sso_1807_recibos to authenticated;
-- Núcleos privados chamados apenas no setup como owner, para representar recibos antigos reais.
insert into pg_temp.sso_1807_recibos values ('contratos',pcm.sso_iniciar_revisao_plano_com_contratos('18070000-0000-4000-8000-000000000001','18040000-0000-4000-8000-00000000000a','18040000-0000-4000-8000-000000000011',4,'18070001-0000-4000-8000-000000000001'));
insert into pg_temp.sso_1807_recibos values ('evidencias',pcm.sso_iniciar_revisao_plano_com_evidencias('18070000-0000-4000-8000-000000000002','18040000-0000-4000-8000-00000000000a','18040000-0000-4000-8000-000000000012',4,'18070001-0000-4000-8000-000000000002'));
insert into pg_temp.sso_1807_recibos values ('exigencias',pcm.sso_iniciar_revisao_com_exigencias('18070000-0000-4000-8000-000000000003','18040000-0000-4000-8000-00000000000a','18040000-0000-4000-8000-000000000013',4,'18070001-0000-4000-8000-000000000003'));
set local role authenticated;
do $$ declare r jsonb; begin
 r:=pcm.sso_iniciar_revisao_contratos_mediada('18040000-0000-4000-8000-000000000001','18040000-0000-4000-8000-00000000000a','18040000-0000-4000-8000-000000000011','18070000-0000-4000-8000-000000000001',4,'18070001-0000-4000-8000-000000000001','contratos');
 if r is distinct from (select resultado from pg_temp.sso_1807_recibos where modo='contratos') then raise exception 'replay_legado_divergente'; end if;
end $$;
do $$ declare r jsonb; begin
 r:=pcm.sso_iniciar_revisao_contratos_mediada('18040000-0000-4000-8000-000000000001','18040000-0000-4000-8000-00000000000a','18040000-0000-4000-8000-000000000012','18070000-0000-4000-8000-000000000002',4,'18070001-0000-4000-8000-000000000002','evidencias');
 if r is distinct from (select resultado from pg_temp.sso_1807_recibos where modo='evidencias') then raise exception 'replay_legado_divergente'; end if;
end $$;
do $$ declare r jsonb; begin
 r:=pcm.sso_iniciar_revisao_contratos_mediada('18040000-0000-4000-8000-000000000001','18040000-0000-4000-8000-00000000000a','18040000-0000-4000-8000-000000000013','18070000-0000-4000-8000-000000000003',4,'18070001-0000-4000-8000-000000000003','exigencias');
 if r is distinct from (select resultado from pg_temp.sso_1807_recibos where modo='exigencias') then raise exception 'replay_legado_divergente'; end if;
end $$;
reset role;
update pcm.sso_revisao_contrato_gate set habilitado=false where id;
update pcm.sso_contrato_pergunta_gate set habilitado=false where id;
set local role authenticated;
do $$ declare r jsonb; begin
 r:=pcm.sso_iniciar_revisao_contratos_mediada('18040000-0000-4000-8000-000000000001','18040000-0000-4000-8000-00000000000a','18040000-0000-4000-8000-000000000012','18070000-0000-4000-8000-000000000002',4,'18070001-0000-4000-8000-000000000002','evidencias');
 if r is distinct from (select resultado from pg_temp.sso_1807_recibos where modo='evidencias') then raise exception 'replay_transitivo_divergente'; end if;
end $$;
do $$ declare r jsonb; begin
 r:=pcm.sso_iniciar_revisao_contratos_mediada('18040000-0000-4000-8000-000000000001','18040000-0000-4000-8000-00000000000a','18040000-0000-4000-8000-000000000013','18070000-0000-4000-8000-000000000003',4,'18070001-0000-4000-8000-000000000003','exigencias');
 if r is distinct from (select resultado from pg_temp.sso_1807_recibos where modo='exigencias') then raise exception 'replay_transitivo_divergente'; end if;
end $$;
reset role;
update pcm.sso_revisao_contrato_gate set habilitado=true where id;
update pcm.sso_contrato_pergunta_gate set habilitado=true where id;
set local role authenticated;
do $$ declare r jsonb; repetido jsonb; begin
 r:=pcm.sso_iniciar_revisao_contratos_mediada('18040000-0000-4000-8000-000000000001','18040000-0000-4000-8000-00000000000a','18040000-0000-4000-8000-000000000014','18070000-0000-4000-8000-000000000004',4,'18070001-0000-4000-8000-000000000004','contratos');
 repetido:=pcm.sso_iniciar_revisao_contratos_mediada('18040000-0000-4000-8000-000000000001','18040000-0000-4000-8000-00000000000a','18040000-0000-4000-8000-000000000014','18070000-0000-4000-8000-000000000004',4,'18070001-0000-4000-8000-000000000004','contratos');
 if r is distinct from repetido or r->>'aggregateId' is distinct from '18040000-0000-4000-8000-000000000014' or r->'linkedIds'->>'versaoId' is distinct from '18070001-0000-4000-8000-000000000004' then raise exception 'novo_ou_replay_divergente'; end if;
 begin
  perform pcm.sso_iniciar_revisao_contratos_mediada('18040000-0000-4000-8000-000000000001','18040000-0000-4000-8000-00000000000a','18040000-0000-4000-8000-000000000014','18070000-0000-4000-8000-000000000004',4,'18070001-0000-4000-8000-000000000099','contratos');
  raise exception 'colisao_aceita';
 exception when unique_violation then null; end;
end $$;
do $$ declare r jsonb; repetido jsonb; begin
 r:=pcm.sso_iniciar_revisao_contratos_mediada('18040000-0000-4000-8000-000000000001','18040000-0000-4000-8000-00000000000a','18040000-0000-4000-8000-000000000015','18070000-0000-4000-8000-000000000005',4,'18070001-0000-4000-8000-000000000005','evidencias');
 repetido:=pcm.sso_iniciar_revisao_contratos_mediada('18040000-0000-4000-8000-000000000001','18040000-0000-4000-8000-00000000000a','18040000-0000-4000-8000-000000000015','18070000-0000-4000-8000-000000000005',4,'18070001-0000-4000-8000-000000000005','evidencias');
 if r is distinct from repetido or r->>'aggregateId' is distinct from '18040000-0000-4000-8000-000000000015' or r->'linkedIds'->>'versaoId' is distinct from '18070001-0000-4000-8000-000000000005' then raise exception 'novo_ou_replay_divergente'; end if;
 begin
  perform pcm.sso_iniciar_revisao_contratos_mediada('18040000-0000-4000-8000-000000000001','18040000-0000-4000-8000-00000000000a','18040000-0000-4000-8000-000000000015','18070000-0000-4000-8000-000000000005',4,'18070001-0000-4000-8000-000000000099','evidencias');
  raise exception 'colisao_aceita';
 exception when unique_violation then null; end;
end $$;
do $$ declare r jsonb; repetido jsonb; begin
 r:=pcm.sso_iniciar_revisao_contratos_mediada('18040000-0000-4000-8000-000000000001','18040000-0000-4000-8000-00000000000a','18040000-0000-4000-8000-000000000016','18070000-0000-4000-8000-000000000006',4,'18070001-0000-4000-8000-000000000006','exigencias');
 repetido:=pcm.sso_iniciar_revisao_contratos_mediada('18040000-0000-4000-8000-000000000001','18040000-0000-4000-8000-00000000000a','18040000-0000-4000-8000-000000000016','18070000-0000-4000-8000-000000000006',4,'18070001-0000-4000-8000-000000000006','exigencias');
 if r is distinct from repetido or r->>'aggregateId' is distinct from '18040000-0000-4000-8000-000000000016' or r->'linkedIds'->>'versaoId' is distinct from '18070001-0000-4000-8000-000000000006' then raise exception 'novo_ou_replay_divergente'; end if;
 begin
  perform pcm.sso_iniciar_revisao_contratos_mediada('18040000-0000-4000-8000-000000000001','18040000-0000-4000-8000-00000000000a','18040000-0000-4000-8000-000000000016','18070000-0000-4000-8000-000000000006',4,'18070001-0000-4000-8000-000000000099','exigencias');
  raise exception 'colisao_aceita';
 exception when unique_violation then null; end;
end $$;
do $$ begin
 begin
  perform pcm.sso_iniciar_revisao_contratos_mediada('18040000-0000-4000-8000-000000000099','18040000-0000-4000-8000-00000000000a','18040000-0000-4000-8000-000000000014','18070000-0000-4000-8000-000000000004',4,'18070001-0000-4000-8000-000000000004','contratos');
  raise exception 'ator_divergente_aceito';
 exception when insufficient_privilege then null; end;
 begin
  perform pcm.sso_iniciar_revisao_contratos_mediada('18040000-0000-4000-8000-000000000001','18040000-0000-4000-8000-000000000099','18040000-0000-4000-8000-000000000014','18070000-0000-4000-8000-000000000004',4,'18070001-0000-4000-8000-000000000004','contratos');
  raise exception 'cliente_divergente_aceito';
 exception when insufficient_privilege then null; end;
 begin
  perform pcm.sso_iniciar_revisao_contratos_mediada('18040000-0000-4000-8000-000000000001','18040000-0000-4000-8000-00000000000a','18040000-0000-4000-8000-000000000014','18070000-0000-4000-8000-000000000004',4,'18070001-0000-4000-8000-000000000004','evidencias');
  raise exception 'modo_divergente_aceito';
 exception when unique_violation then null; end;
end $$;
reset role;
rollback;
