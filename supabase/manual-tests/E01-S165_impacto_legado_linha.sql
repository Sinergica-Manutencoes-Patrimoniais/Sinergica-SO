-- Executar com outra sessão mantendo a trava transacional do protocolo 0787.
-- A migration 1001 deve estar instalada na mesma transação antes deste conteúdo.
-- Todos os registros e o gate são revertidos. Não chama avaliação nem aprovação.
set local app.auvo_sync_write='true';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('16590000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s165-impacto-linha@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into pcm.clientes(id,nome,ativo,created_by) values ('16590000-0000-4000-8000-00000000000a','Cliente sintético S165',true,'16590000-0000-4000-8000-000000000001');
insert into pcm.sistemas(id,cliente_id,nome) values ('16590000-0000-4000-8000-000000000051','16590000-0000-4000-8000-00000000000a','Sistema sintético');
insert into pcm.questionarios(id,auvo_id,nome,perguntas,ativo) values ('16590000-0000-4000-8000-000000000091',165900091,'Questionário sintético','[]'::jsonb,true);
insert into pcm.tipos_tarefa(id,nome) values ('16590000-0000-4000-8000-000000000092','Tipo sintético');
insert into pcm.planos_preventivos(id,cliente_id,sistema_id,questionario_id,tipo_tarefa_id,nome,primeira_data,intervalo_unidade,intervalo_n,created_by)
values ('16590000-0000-4000-8000-000000000011','16590000-0000-4000-8000-00000000000a','16590000-0000-4000-8000-000000000051','16590000-0000-4000-8000-000000000091','16590000-0000-4000-8000-000000000092','Plano sintético','2030-01-01','meses',1,'16590000-0000-4000-8000-000000000001');
update pcm.sso_concorrencia_impacto_gate set habilitado=true where id;
do $$
begin
  if (select count(*) from pcm.planos_preventivos where cliente_id='16590000-0000-4000-8000-00000000000a') <> 1 then raise exception 'fixture_invalida'; end if;
  begin
    delete from pcm.planos_preventivos where id='16590000-0000-4000-8000-000000000011';
    raise exception 'exclusao_alterou_fonte_impacto';
  exception when lock_not_available then null; end;
  if (select count(*) from pcm.planos_preventivos where cliente_id='16590000-0000-4000-8000-00000000000a') <> 1 then raise exception 'contagem_impacto_alterada'; end if;
end $$;
