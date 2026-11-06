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
set local request.jwt.claims = '{"sub":"18040000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;

do $$
declare
  v_plano constant uuid := '18040000-0000-4000-8000-000000000011';
  v_cliente constant uuid := '18040000-0000-4000-8000-00000000000a';
  v_ator constant uuid := '18040000-0000-4000-8000-000000000001';
  v_pedido constant uuid := '18040000-0000-4000-8000-000000000104';
  v_criacao jsonb; v_rotina jsonb; v_transicao jsonb; v_previa jsonb;
  v_versao uuid; v_recibo jsonb; v_repetido jsonb; v_legado jsonb;
begin
  v_criacao := pcm.sso_salvar_plano_rascunho('18040000-0000-4000-8000-000000000101',0,v_plano,v_cliente,'Plano inicial sintético');
  if (v_criacao->>'revision')::integer <> 1 then raise exception 'criacao_divergente'; end if;
  v_rotina := pcm.sso_adicionar_rotina_rascunho_v2('18040000-0000-4000-8000-000000000102',1,v_plano,
    '18040000-0000-4000-8000-000000000081','Rotina mensal','sistema','18040000-0000-4000-8000-000000000051',
    'calendario',1,'meses',current_date,30,0,0,'Inspecionar',null,'total');
  if (v_rotina->>'revision')::integer <> 2 then raise exception 'rotina_divergente'; end if;
  v_versao := (v_rotina->'linkedIds'->>'versaoId')::uuid;
  v_transicao := pcm.sso_transicionar_revisao_plano('18040000-0000-4000-8000-000000000103',2,v_plano,'submeter');
  if (v_transicao->>'revision')::integer <> 3 then raise exception 'submissao_divergente'; end if;
  v_previa := pcm.sso_preparar_aprovacao_versao(v_ator,v_cliente,v_plano,3);
  if v_previa->>'versaoId' is distinct from v_versao::text then raise exception 'previa_divergente'; end if;

  begin
    perform pcm.sso_aprovar_versao_esperada(v_ator,v_cliente,v_pedido,3,v_plano,
      '18040000-0000-4000-8000-000000000099',current_date,false);
    raise exception 'versao_errada_aceita';
  exception when sqlstate 'P0011' then null; end;
  if not exists(select 1 from pcm.planos_manutencao where id=v_plano and revisao=3 and estado='em_revisao') then
    raise exception 'rejeicao_alterou_plano'; end if;

  v_recibo := pcm.sso_aprovar_versao_esperada(v_ator,v_cliente,v_pedido,3,v_plano,v_versao,current_date,false);
  if v_recibo->>'requestId' is distinct from v_pedido::text or v_recibo->>'aggregateId' is distinct from v_plano::text
    or v_recibo->>'state' is distinct from 'aprovado' or (v_recibo->>'revision')::integer <> 4
    or v_recibo->'linkedIds'->>'versaoId' is distinct from v_versao::text then
    raise exception 'aprovacao_inicial_divergente'; end if;
  v_repetido := pcm.sso_aprovar_versao_esperada(v_ator,v_cliente,v_pedido,3,v_plano,v_versao,current_date,false);
  if v_repetido is distinct from v_recibo then raise exception 'replay_novo_divergente'; end if;
  v_legado := pcm.sso_aprovar_plano(v_pedido,3,v_plano,current_date);
  if v_legado is distinct from v_recibo then raise exception 'replay_legado_divergente'; end if;
end; $$;

reset role;
do $$ begin
  if (select count(*) from pcm.plano_comandos where request_id='18040000-0000-4000-8000-000000000104') <> 1 then
    raise exception 'recibo_duplicado_ou_ausente'; end if;
end; $$;
rollback;
