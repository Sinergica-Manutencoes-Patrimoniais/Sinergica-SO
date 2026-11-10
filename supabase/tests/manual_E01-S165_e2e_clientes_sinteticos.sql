-- Preparação parcial do E2E S165. Somente em clone descartável já atestado pelo chamador.
-- O chamador aplica em transação única; s165_senha é fornecida via stdin do psql.
-- Dois atores têm concessões disjuntas para provar isolamento entre Clientes.
-- Prepara um Plano aprovado com origem de questionário sintética; não prepara revisão ou impactos.
set local app.auvo_sync_write = 'true';
do $$ begin
 if current_setting('app.sso_ensaio_descartavel', true) is distinct from 's165' then
  raise exception 'fixture_exige_clone_descartavel' using errcode='55000';
 end if;
end $$;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
 confirmation_token,recovery_token,email_change,email_change_token_new,
 raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('16591000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','s165-e2e-sintetico@example.test',crypt(:'s165_senha',gen_salt('bf')),
 now(),'','','','', '{}','{}',now(),now());
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
 confirmation_token,recovery_token,email_change,email_change_token_new,
 raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('16591000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','s165-e2e-sintetico-b@example.test',crypt(:'s165_senha',gen_salt('bf')),
 now(),'','','','', '{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo)
values
 ('16591000-0000-4000-8000-000000000001','colaborador','Operador sintético S165 A',true),
 ('16591000-0000-4000-8000-000000000002','colaborador','Operador sintético S165 B',true);
insert into config.usuario_modulos(user_id,modulo,nivel)
values
 ('16591000-0000-4000-8000-000000000001','pcm','escrita'),
 ('16591000-0000-4000-8000-000000000002','pcm','escrita');
insert into pcm.clientes(id,nome,ativo,created_by) values
 ('16591000-0000-4000-8000-00000000000a','Cliente sintético S165 A',true,'16591000-0000-4000-8000-000000000001'),
 ('16591000-0000-4000-8000-00000000000b','Cliente sintético S165 B',true,'16591000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values
 ('16591000-0000-4000-8000-000000000001','plano.gerir','16591000-0000-4000-8000-00000000000a'),
 ('16591000-0000-4000-8000-000000000002','plano.gerir','16591000-0000-4000-8000-00000000000b');

-- Origem externa sintética, sem chamada à integração Auvo.
insert into pcm.questionarios(id,auvo_id,nome,perguntas,ativo)
values ('16591000-0000-4000-8000-000000000051',1659100051,'Questionário sintético',
 '[{"id":"s165-p1","titulo":"Inspeção sintética"}]'::jsonb,true);
insert into pcm.sistemas(id,cliente_id,nome)
values ('16591000-0000-4000-8000-000000000052','16591000-0000-4000-8000-00000000000a','Sistema histórico sintético');
set local request.jwt.claims = '{"sub":"16591000-0000-4000-8000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
set local role authenticated;
do $$
declare r jsonb; v_versao uuid;
begin
 r:=pcm.sso_salvar_plano_rascunho('16591000-0000-4000-8000-000000000101',0,'16591000-0000-4000-8000-000000000011','16591000-0000-4000-8000-00000000000a','Plano histórico sintético');
 if (r->>'revision')::integer <> 1 then raise exception 'plano_fixture_divergente'; end if;
 r:=pcm.sso_adicionar_rotina_rascunho_v2('16591000-0000-4000-8000-000000000102',1,'16591000-0000-4000-8000-000000000011',
  '16591000-0000-4000-8000-000000000081','Rotina histórica sintética','sistema','16591000-0000-4000-8000-000000000052',
  'calendario',1,'meses',current_date,30,0,0,'Inspecionar','16591000-0000-4000-8000-000000000051','total');
 if (r->>'revision')::integer <> 2 then raise exception 'rotina_fixture_divergente'; end if;
 v_versao:=(r->'linkedIds'->>'versaoId')::uuid;
 r:=pcm.sso_transicionar_revisao_plano('16591000-0000-4000-8000-000000000103',2,'16591000-0000-4000-8000-000000000011','submeter');
 if (r->>'revision')::integer <> 3 then raise exception 'submissao_fixture_divergente'; end if;
 r:=pcm.sso_aprovar_plano('16591000-0000-4000-8000-000000000104',3,'16591000-0000-4000-8000-000000000011',current_date);
 if r->>'state' is distinct from 'aprovado' or r->'linkedIds'->>'versaoId' is distinct from v_versao::text then
  raise exception 'aprovacao_fixture_divergente'; end if;
end $$;
reset role;
