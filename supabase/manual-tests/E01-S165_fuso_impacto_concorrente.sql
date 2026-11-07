-- Banco descartável apenas: outra sessão deve manter a trava de 0787.
-- Executar dentro de transação revertida; sem alteração persistente de gates.
set local app.auvo_sync_write='true';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('16592000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s165-fuso@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into pcm.clientes(id,nome,ativo,created_by) values ('16592000-0000-4000-8000-00000000000a','Cliente sintético fuso',true,'16592000-0000-4000-8000-000000000001');
insert into pcm.planos_manutencao(id,cliente_id,nome,estado,created_by) values ('16592000-0000-4000-8000-000000000011','16592000-0000-4000-8000-00000000000a','Plano sintético fuso','rascunho','16592000-0000-4000-8000-000000000001');
insert into pcm.sso_fusos_plano_declarados(request_id,cliente_id,plano_id,revisao,fuso,fonte,motivo,ator_id,payload,resultado)
values ('16592000-0000-4000-8000-000000000031','16592000-0000-4000-8000-00000000000a','16592000-0000-4000-8000-000000000011',1,'America/Sao_Paulo','teste','teste','16592000-0000-4000-8000-000000000001','{}','{}');
update pcm.sso_concorrencia_impacto_gate set habilitado=true where id;
do $$ begin
  begin
    insert into pcm.sso_fusos_plano_declarados(request_id,cliente_id,plano_id,revisao,fuso,fonte,motivo,ator_id,payload,resultado)
    values ('16592000-0000-4000-8000-000000000032','16592000-0000-4000-8000-00000000000a','16592000-0000-4000-8000-000000000011',2,'America/Manaus','teste','teste','16592000-0000-4000-8000-000000000001','{}','{}');
    raise exception 'fuso_impacto_alterado_sem_serializacao';
  exception when lock_not_available then null; end;
  if (select fuso from pcm.sso_fusos_plano_declarados where plano_id='16592000-0000-4000-8000-000000000011' order by revisao desc limit 1) <> 'America/Sao_Paulo' then
    raise exception 'fuso_divergente';
  end if;
  begin
    insert into pcm.sso_decisoes_impacto_ocorrencia(request_id) select null::uuid where false;
    raise exception 'decisao_impacto_nao_serializada';
  exception when lock_not_available then null; end;
end $$;
