-- Base isolada; fixtures e evento duplicado revertidos. Não aciona serviços externos.
begin;
set local app.auvo_sync_write='true';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('16591000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s165-origem@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16591000-0000-4000-8000-000000000001','superadmin','Gestor sintético',true);
insert into pcm.clientes(id,nome,ativo,created_by) values ('16591000-0000-4000-8000-00000000000a','Cliente sintético',true,'16591000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16591000-0000-4000-8000-000000000001','plano.gerir','16591000-0000-4000-8000-00000000000a');
insert into pcm.planos_manutencao(id,cliente_id,nome,estado,created_by) values ('16591000-0000-4000-8000-000000000011','16591000-0000-4000-8000-00000000000a','Plano sintético','em_revisao','16591000-0000-4000-8000-000000000001');
insert into pcm.plano_versoes(id,plano_id,numero,estado,snapshot,created_by) values
 ('16591000-0000-4000-8000-000000000021','16591000-0000-4000-8000-000000000011',1,'aprovado','{"rotinas":[]}'::jsonb,'16591000-0000-4000-8000-000000000001'),
 ('16591000-0000-4000-8000-000000000022','16591000-0000-4000-8000-000000000011',2,'rascunho',null,'16591000-0000-4000-8000-000000000001');
insert into pcm.plano_comandos(request_id,actor_id,cliente_id,payload,resultado) values
 ('16591000-0000-4000-8000-000000000031','16591000-0000-4000-8000-000000000001','16591000-0000-4000-8000-00000000000a',
 '{"tipo":"iniciarRevisaoPlano","planoId":"16591000-0000-4000-8000-000000000011"}',
 '{"linkedIds":{"versaoId":"16591000-0000-4000-8000-000000000022","versaoOrigemId":"16591000-0000-4000-8000-000000000021"}}');
select set_config('request.jwt.claims','{"sub":"16591000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);
insert into audit.events(actor_id,action,entity,entity_id,payload) values
 ('16591000-0000-4000-8000-000000000001','plano.revisao_iniciada','planos_manutencao','16591000-0000-4000-8000-000000000011',
 '{"requestId":"16591000-0000-4000-8000-000000000031","versaoId":"16591000-0000-4000-8000-000000000022","origem":"16591000-0000-4000-8000-000000000099"}');
do $$ begin
  begin
    perform pcm.sso_previa_revisao_revisionada('16591000-0000-4000-8000-000000000011',1,1,null);
    raise exception 'evento_divergente_aceito';
  exception when check_violation then
    if sqlerrm <> 'origem_revisao_indisponivel' then raise; end if;
  end;
end $$;
insert into audit.events(actor_id,action,entity,entity_id,payload) values
 ('16591000-0000-4000-8000-000000000001','plano.revisao_iniciada','planos_manutencao','16591000-0000-4000-8000-000000000011',
 '{"requestId":"16591000-0000-4000-8000-000000000031","versaoId":"16591000-0000-4000-8000-000000000022","origem":"16591000-0000-4000-8000-000000000021"}');
select pcm.sso_previa_revisao_revisionada('16591000-0000-4000-8000-000000000011',1,1,null)->>'versaoAnteriorId' as origem_antes;
set local role service_role;
insert into audit.events(actor_id,action,entity,entity_id,payload) values
 ('16591000-0000-4000-8000-000000000001','plano.revisao_iniciada','planos_manutencao','16591000-0000-4000-8000-000000000011',
 '{"requestId":"16591000-0000-4000-8000-000000000031","versaoId":"16591000-0000-4000-8000-000000000022","origem":"16591000-0000-4000-8000-000000000021"}');
reset role;
do $$ begin
  if pcm.sso_previa_revisao_revisionada('16591000-0000-4000-8000-000000000011',1,1,null)->>'versaoAnteriorId'
    <> '16591000-0000-4000-8000-000000000021' then raise exception 'origem_incorreta'; end if;
end $$;
insert into pcm.plano_comandos(request_id,actor_id,cliente_id,payload,resultado) values
 ('16591000-0000-4000-8000-000000000032','16591000-0000-4000-8000-000000000001','16591000-0000-4000-8000-00000000000a',
 '{"tipo":"iniciarRevisaoPlano","planoId":"16591000-0000-4000-8000-000000000011"}',
 '{"linkedIds":{"versaoId":"16591000-0000-4000-8000-000000000022","versaoOrigemId":"16591000-0000-4000-8000-000000000021"}}');
insert into audit.events(actor_id,action,entity,entity_id,payload) values
 ('16591000-0000-4000-8000-000000000001','plano.revisao_iniciada','planos_manutencao','16591000-0000-4000-8000-000000000011',
 '{"requestId":"16591000-0000-4000-8000-000000000032","versaoId":"16591000-0000-4000-8000-000000000022","origem":"16591000-0000-4000-8000-000000000021"}');
do $$ begin
  begin
    perform pcm.sso_previa_revisao_revisionada('16591000-0000-4000-8000-000000000011',1,1,null);
    raise exception 'comandos_multiplos_nao_detectados';
  exception when check_violation then
    if sqlerrm <> 'origem_revisao_indisponivel' then raise; end if;
  end;
end $$;
rollback;
