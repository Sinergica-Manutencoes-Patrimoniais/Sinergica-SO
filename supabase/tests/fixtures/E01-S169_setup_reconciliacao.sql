-- Apenas banco sintético dedicado, nunca executar em banco oficial.
DO $$ BEGIN IF current_database() <> 'sso_transporte_169' THEN RAISE EXCEPTION 'banco_sintetico_obrigatorio'; END IF; END $$;
create schema auth;
create schema config;
create schema pcm;
create schema audit;
create table auth.users(id uuid primary key);
create table config.usuarios(user_id uuid primary key);
create table pcm.clientes(id uuid primary key);
create table audit.events(actor_id uuid,action text,entity text,entity_id uuid,payload jsonb);
create function auth.uid() returns uuid language sql stable as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;
create function config.sso_autorizar_acao(text,uuid) returns boolean language sql stable as $$ select true $$;
\i supabase/migrations/0315_E01-S178_recepcao_staging.sql
\i supabase/migrations/0327_E01-S178_conferencia_staging.sql
\i supabase/migrations/0347_E01-S169_staging_cronograma.sql
\i supabase/migrations/0361_E01-S169_staging_unificado.sql
insert into auth.users values('00000000-0000-0000-0000-000000000001');
insert into config.usuarios values('00000000-0000-0000-0000-000000000001');
insert into pcm.clientes values('00000000-0000-0000-0000-000000000020');
insert into pcm.cronograma_importacao_lotes(id,cliente_id,fonte_id,matriz,revisao,criado_por) values('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000020','teste','[[1],[2],[3],[4],[5]]',2,'00000000-0000-0000-0000-000000000001');
insert into pcm.cronograma_importacao_revisoes(id,lote_id,revisao,numero_linha,observacao,ator_id) values('00000000-0000-0000-0000-000000000040','00000000-0000-0000-0000-000000000010',2,2,'revisão teste','00000000-0000-0000-0000-000000000001');
insert into pcm.cronograma_importacao_comandos(request_id,ator_id,cliente_id,payload,resultado) values('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000020','{"tipo":"receber","loteId":"00000000-0000-0000-0000-000000000010"}','{"aggregateId":"00000000-0000-0000-0000-000000000010"}');
