-- Banco isolado, fixtures sintéticas revertidas; reprodução de alteração privilegiada.
begin;
set local app.auvo_sync_write='true';
set local session_replication_role=replica;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('16593000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s165-foto@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16593000-0000-4000-8000-000000000001','superadmin','Gestor sintético',true);
insert into pcm.clientes(id,nome,ativo,created_by) values ('16593000-0000-4000-8000-00000000000a','Cliente sintético',true,'16593000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16593000-0000-4000-8000-000000000001','plano.gerir','16593000-0000-4000-8000-00000000000a');
insert into pcm.sistemas(id,cliente_id,nome) values ('16593000-0000-4000-8000-000000000051','16593000-0000-4000-8000-00000000000a','Sistema sintético');
insert into pcm.planos_manutencao(id,cliente_id,nome,estado,created_by) values ('16593000-0000-4000-8000-000000000011','16593000-0000-4000-8000-00000000000a','Plano sintético','em_revisao','16593000-0000-4000-8000-000000000001');
insert into pcm.plano_versoes(id,plano_id,numero,estado,snapshot,created_by) values
 ('16593000-0000-4000-8000-000000000021','16593000-0000-4000-8000-000000000011',1,'aprovado','{"rotinas":[]}'::jsonb,'16593000-0000-4000-8000-000000000001'),
 ('16593000-0000-4000-8000-000000000022','16593000-0000-4000-8000-000000000011',2,'rascunho',null,'16593000-0000-4000-8000-000000000001');
insert into pcm.rotinas_manutencao(id,rotina_logica_id,plano_id,versao_id,nome,alvo_tipo,sistema_id,modo,created_by) values
 ('16593000-0000-4000-8000-000000000081','16593000-0000-4000-8000-000000000083','16593000-0000-4000-8000-000000000011','16593000-0000-4000-8000-000000000021','Rotina sintética','sistema','16593000-0000-4000-8000-000000000051','calendario','16593000-0000-4000-8000-000000000001');
insert into pcm.plano_comandos(request_id,actor_id,cliente_id,payload,resultado) values
 ('16593000-0000-4000-8000-000000000031','16593000-0000-4000-8000-000000000001','16593000-0000-4000-8000-00000000000a',
 '{"tipo":"iniciarRevisaoPlano","planoId":"16593000-0000-4000-8000-000000000011"}',
 '{"linkedIds":{"versaoId":"16593000-0000-4000-8000-000000000022","versaoOrigemId":"16593000-0000-4000-8000-000000000021"}}');
insert into audit.events(actor_id,action,entity,entity_id,payload) values
 ('16593000-0000-4000-8000-000000000001','plano.revisao_iniciada','planos_manutencao','16593000-0000-4000-8000-000000000011',
 '{"requestId":"16593000-0000-4000-8000-000000000031","versaoId":"16593000-0000-4000-8000-000000000022","origem":"16593000-0000-4000-8000-000000000021"}');
insert into pcm.ocorrencias_rotina_preparadas(id,plano_id,versao_id,rotina_id,rotina_logica_id,alvo_tipo,alvo_id,ciclo,vencimento_original,tolerancia_antes,tolerancia_depois,created_by)
values ('16593000-0000-4000-8000-000000000091','16593000-0000-4000-8000-000000000011','16593000-0000-4000-8000-000000000021','16593000-0000-4000-8000-000000000081','16593000-0000-4000-8000-000000000083','sistema','16593000-0000-4000-8000-000000000051',1,'2030-01-01',0,0,'16593000-0000-4000-8000-000000000001');
insert into pcm.sso_decisoes_impacto_ocorrencia(request_id,cliente_id,plano_id,rascunho_id,preparada_id,revisao_plano,revisao,decisao,motivo,fotografia,ator_id,payload,resultado)
select '16593000-0000-4000-8000-000000000032','16593000-0000-4000-8000-00000000000a',o.plano_id,'16593000-0000-4000-8000-000000000022',o.id,1,1,'manter_sem_alterar','teste',jsonb_build_object('preparada',to_jsonb(o),'legadaId',null,'os','[]'::jsonb),'16593000-0000-4000-8000-000000000001','{}','{}' from pcm.ocorrencias_rotina_preparadas o where o.id='16593000-0000-4000-8000-000000000091';
set local session_replication_role=origin;
update pcm.sso_avaliacao_impacto_revisao_gate set habilitado=true where id;
update pcm.sso_decisao_impacto_revisao_gate set habilitado=true where id;
select set_config('request.jwt.claims','{"sub":"16593000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}',true);
do $$ begin
 if (pcm.sso_avaliar_decisoes_impacto('16593000-0000-4000-8000-00000000000a','16593000-0000-4000-8000-000000000011',1)->>'decisoesObsoletas')::int <> 0 then raise exception 'fixture_nao_conferida'; end if;
end $$;
update pcm.ocorrencias_rotina_preparadas set created_at=created_at + interval '1 second' where id='16593000-0000-4000-8000-000000000091';
do $$ begin
 if (pcm.sso_avaliar_decisoes_impacto('16593000-0000-4000-8000-00000000000a','16593000-0000-4000-8000-000000000011',1)->>'decisoesObsoletas')::int <> 0 then raise exception 'metadado_irrelevante_obsoleta'; end if;
end $$;
update pcm.ocorrencias_rotina_preparadas set tolerancia_antes=2 where id='16593000-0000-4000-8000-000000000091';
do $$ begin
 if (pcm.sso_avaliar_decisoes_impacto('16593000-0000-4000-8000-00000000000a','16593000-0000-4000-8000-000000000011',1)->>'decisoesObsoletas')::int <> 1 then raise exception 'fotografia_preparada_obsoleta_nao_detectada'; end if;
end $$;
rollback;
