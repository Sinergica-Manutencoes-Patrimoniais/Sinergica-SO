-- 1806: gate, token, replay e ACL; somente clone descartável com ON_ERROR_STOP.
-- Somente clone vazio descartável; requer migrations até 1805 e psql ON_ERROR_STOP.
-- Fixture sintética ativa o anti-loop Auvo via GUC (não testa outbox). Sem rede/jobs externos.
-- Não confirma transações: a verificação pós-commit requer harness isolado separado.
-- Apenas clone sintético descartável com migrations até 1804; psql ON_ERROR_STOP.
-- Nenhuma guarda é desabilitada. O gate da borda nova é habilitado só nesta transação.
begin;

-- Instrumentação transacional apenas neste clone: observa inserções sem alterar ACL.
-- A função de trigger é temporária e a alteração da tabela é revertida no ROLLBACK.
create temp table sso_1806_tokens_observados(request_id uuid, versao_id uuid) on commit drop;
create function pg_temp.sso_1806_observar_token() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  insert into pg_temp.sso_1806_tokens_observados values (new.request_id,new.versao_id);
  return new;
end $$;
create trigger sso_1806_observar_token after insert on pcm.sso_aprovacao_versao_tokens
for each row execute function pg_temp.sso_1806_observar_token();
-- Verificação das permissões efetivas e FORCE RLS exigidos pela 1806, sem GRANT.
do $$
declare borda oid; guarda oid; gate oid; nucleo oid; r record; rel regclass;
begin
 select proowner into strict borda from pg_proc where oid='pcm.sso_aprovar_versao_esperada(uuid,uuid,uuid,integer,uuid,uuid,date,boolean)'::regprocedure and prosecdef;
 select proowner into strict guarda from pg_proc where oid='pcm.sso_exigir_token_versao_aprovacao(uuid,uuid,uuid,integer,date,uuid)'::regprocedure and prosecdef;
 select proowner into strict gate from pg_proc where oid='pcm.sso_versao_aprovacao_exigida()'::regprocedure and prosecdef;
 select proowner into strict nucleo from pg_proc where oid='pcm.sso_aprovar_plano(uuid,integer,uuid,date)'::regprocedure and prosecdef;
 for r in select oid,rolsuper,rolbypassrls from pg_roles where oid in (borda,guarda,gate) loop
   if not (r.rolsuper or r.rolbypassrls) then raise exception 'owner_sem_bypass_rls'; end if;
 end loop;
 if not has_table_privilege(borda,'pcm.sso_aprovacao_versao_tokens','INSERT')
   or not has_table_privilege(borda,'pcm.sso_aprovacao_versao_tokens','DELETE')
   or not has_table_privilege(guarda,'pcm.sso_aprovacao_versao_tokens','SELECT')
   or not has_table_privilege(guarda,'pcm.sso_exigir_versao_aprovacao_gate','SELECT')
   or not has_table_privilege(guarda,'pcm.sso_exigir_versao_aprovacao_gate','UPDATE')
   or not has_table_privilege(gate,'pcm.sso_exigir_versao_aprovacao_gate','SELECT')
   or not has_table_privilege(gate,'pcm.sso_exigir_versao_aprovacao_gate','UPDATE')
   or not has_function_privilege(borda,'pcm.sso_versao_aprovacao_exigida()','EXECUTE')
   or not has_function_privilege(nucleo,'pcm.sso_exigir_token_versao_aprovacao(uuid,uuid,uuid,integer,date,uuid)','EXECUTE')
 then raise exception 'privilegios_owner_insuficientes'; end if;
 for rel in select unnest(array['pcm.sso_aprovacao_versao_tokens'::regclass,'pcm.sso_exigir_versao_aprovacao_gate'::regclass]) loop
   if not exists(select 1 from pg_class where oid=rel and relrowsecurity and relforcerowsecurity)
      or exists(select 1 from pg_roles u where u.rolname in ('anon','authenticated','service_role')
        and (has_table_privilege(u.oid,rel,'SELECT') or has_table_privilege(u.oid,rel,'INSERT')
          or has_table_privilege(u.oid,rel,'UPDATE') or has_table_privilege(u.oid,rel,'DELETE')))
   then raise exception 'acl_ou_rls_divergente'; end if;
 end loop;
 if exists(select 1 from pg_roles u where u.rolname in ('anon','authenticated','service_role')
   and (has_function_privilege(u.oid,'pcm.sso_versao_aprovacao_exigida()','EXECUTE')
     or has_function_privilege(u.oid,'pcm.sso_exigir_token_versao_aprovacao(uuid,uuid,uuid,integer,date,uuid)','EXECUTE')))
 then raise exception 'helper_exposto'; end if;
end $$;

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

  v_recibo := pcm.sso_aprovar_plano(v_pedido,3,v_plano,current_date);
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
do $$ begin if exists(select 1 from pg_temp.sso_1806_tokens_observados) then raise exception 'gate_desligado_criou_token'; end if; end $$;
-- Replay de pedido legado concluído continua disponível após ativar o gate.
update pcm.sso_exigir_versao_aprovacao_gate set habilitado=true where id;
set local role authenticated;
do $$ declare r jsonb; begin
 r:=pcm.sso_aprovar_plano('18040000-0000-4000-8000-000000000104',3,'18040000-0000-4000-8000-000000000011',current_date);
 if r->>'requestId' is distinct from '18040000-0000-4000-8000-000000000104' then raise exception 'replay_legado_bloqueado'; end if;
end $$;
do $$
declare
  v_plano constant uuid := '18040000-0000-4000-8000-000000000012';
  v_cliente constant uuid := '18040000-0000-4000-8000-00000000000a';
  v_ator constant uuid := '18040000-0000-4000-8000-000000000001';
  v_pedido constant uuid := '18040000-0000-4000-8000-000000000114';
  v_criacao jsonb; v_rotina jsonb; v_transicao jsonb; v_previa jsonb;
  v_versao uuid; v_recibo jsonb; v_repetido jsonb; v_legado jsonb;
begin
  v_criacao := pcm.sso_salvar_plano_rascunho('18040000-0000-4000-8000-000000000111',0,v_plano,v_cliente,'Plano inicial sintético');
  if (v_criacao->>'revision')::integer <> 1 then raise exception 'criacao_divergente'; end if;
  v_rotina := pcm.sso_adicionar_rotina_rascunho_v2('18040000-0000-4000-8000-000000000112',1,v_plano,
    '18040000-0000-4000-8000-000000000082','Rotina mensal','sistema','18040000-0000-4000-8000-000000000051',
    'calendario',1,'meses',current_date,30,0,0,'Inspecionar',null,'total');
  if (v_rotina->>'revision')::integer <> 2 then raise exception 'rotina_divergente'; end if;
  v_versao := (v_rotina->'linkedIds'->>'versaoId')::uuid;
  v_transicao := pcm.sso_transicionar_revisao_plano('18040000-0000-4000-8000-000000000113',2,v_plano,'submeter');
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

  begin
    perform pcm.sso_aprovar_plano(v_pedido,3,v_plano,current_date);
    raise exception 'aprovacao_legada_nao_bloqueada';
  exception when check_violation then
    if sqlerrm <> 'versao_esperada_obrigatoria' then raise; end if;
  end;
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
 if (select count(*) from pg_temp.sso_1806_tokens_observados where request_id='18040000-0000-4000-8000-000000000114')<>1
   or (select count(*) from pg_temp.sso_1806_tokens_observados)<>1 then
   raise exception 'token_novo_ou_replay_incorreto'; end if;
 if exists(select 1 from pcm.sso_aprovacao_versao_tokens where txid=pg_catalog.txid_current()) then
   raise exception 'token_nao_removido';
 end if;
end $$;
select pg_catalog.txid_current() as fixture_txid \gset
rollback;
-- Checagem em nova transação usando o ID capturado antes do rollback.
select 1 / case when exists(select 1 from pcm.sso_aprovacao_versao_tokens where txid = :fixture_txid) then 0 else 1 end;
