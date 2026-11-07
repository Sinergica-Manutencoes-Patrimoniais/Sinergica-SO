-- PostgreSQL descartável: migrations reais; autenticação e autorização simuladas.
-- Não substitui Supabase completo, pgTAP ou testes de concorrência.
\set ON_ERROR_STOP on
\if :{?fixture_only}
do $$begin if current_database() <> 'sso_s169_descartavel' then raise exception 'fixture exige banco descartavel sso_s169_descartavel'; end if; end$$;
\endif
begin;
create role anon; create role authenticated; create role service_role;
create schema pcm; create schema config; create schema audit; create schema auth;
create table pcm.clientes(id uuid primary key);
create table auth.users(id uuid primary key);
create table config.usuarios(user_id uuid primary key);
create table config.permissao_teste(habilitada boolean not null);
insert into config.permissao_teste values(true);
create table audit.events(actor_id uuid, action text, entity text, entity_id uuid, payload jsonb);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function config.sso_autorizar_acao(p_acao text,p_cliente uuid) returns boolean language sql stable as $$
 select auth.uid()='16891000-0000-4000-8000-000000000001'::uuid and p_acao='plano.gerir' and p_cliente='16891000-0000-4000-8000-000000000002'::uuid and (select habilitada from config.permissao_teste)
$$;
insert into pcm.clientes values('16891000-0000-4000-8000-000000000002');
insert into pcm.clientes values('16891000-0000-4000-8000-000000000003');
insert into auth.users values('16891000-0000-4000-8000-000000000001');
insert into config.usuarios values('16891000-0000-4000-8000-000000000001');
\ir ../migrations/0315_E01-S178_recepcao_staging.sql
\ir ../migrations/0347_E01-S169_staging_cronograma.sql
\ir ../migrations/0361_E01-S169_staging_unificado.sql
\ir ../migrations/0364_E01-S169_consultas_staging_unificado.sql
\ir ../migrations/1048_E01-S169_mediar_staging_cronograma.sql
\ir ../migrations/1081_E01-S169_origem_xlsx_cronograma.sql
insert into pcm.sso_levantamentos(id,cliente_id,origem,chave_origem,conteudo,criado_por)
values('16900000-0000-4000-8000-000000000113','16891000-0000-4000-8000-000000000003','planilha','cronograma:outro','[[1],[2],[3],[4],[5]]','16891000-0000-4000-8000-000000000001');
update pcm.sso_cronograma_staging_gate set habilitado=true where id;
update pcm.sso_mediacao_cronograma_gate set habilitado=true where id;
update pcm.sso_origem_xlsx_cronograma_gate set habilitado=true where id;
set local test.uid='16891000-0000-4000-8000-000000000001';
grant usage on schema pcm to authenticated;
\if :{?fixture_only}
  commit;
  \quit
\endif
set local role authenticated;
do $$ declare p uuid := '16900000-0000-4000-8000-000000000101'; l uuid := '16900000-0000-4000-8000-000000000102'; c uuid := '16891000-0000-4000-8000-000000000002'; h text := 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'; v jsonb; begin
 v := pcm.sso_receber_xlsx_cronograma(p,l,c,'fonte','[[1],[2],[3],[4],[5]]','YWJj',h);
 if v->>'state' <> 'pendente' or (v->>'created')::boolean is not true then raise exception 'recepção inválida'; end if;
 v := pcm.sso_receber_xlsx_cronograma(p,l,c,'fonte','[[1],[2],[3],[4],[5]]','YWJj',h);
 if v->>'aggregateId' <> l::text then raise exception 'replay divergente'; end if;
 begin perform pcm.sso_receber_xlsx_cronograma(p,l,c,'fonte','[[1],[2],[3],[4],[5]]','ZGVm','cb8379ac2098aa165029e3938a51da0bcecfc008fd6795f401178647f96c5b34'); raise exception 'conflito aceito'; exception when sqlstate '23505' then if sqlerrm <> 'origem_xlsx_conflitante' then raise; end if; end;
 begin perform count(*) from pcm.sso_origens_xlsx_cronograma; raise exception 'leitura direta aceita'; exception when insufficient_privilege then null; end;
 begin perform pcm.sso_receber_xlsx_cronograma(p,l,'16891000-0000-4000-8000-000000000099','fonte','[[1],[2],[3],[4],[5]]','YWJj',h); raise exception 'Cliente divergente aceito'; exception when insufficient_privilege then null; end;
 begin perform pcm.sso_receber_xlsx_cronograma('16900000-0000-4000-8000-000000000114','16900000-0000-4000-8000-000000000113',c,'fonte','[[1],[2],[3],[4],[5]]','YWJj',h); raise exception 'lote de outro Cliente aceito'; exception when insufficient_privilege then if sqlerrm <> 'lote_sem_acesso' then raise; end if; end;
 perform pcm.sso_receber_cronograma_mediado('16900000-0000-4000-8000-000000000111','16900000-0000-4000-8000-000000000112',c,'csv','[[1],[2],[3],[4],[5]]');
 begin perform pcm.sso_receber_xlsx_cronograma('16900000-0000-4000-8000-000000000111','16900000-0000-4000-8000-000000000112',c,'csv','[[1],[2],[3],[4],[5]]','YWJj',h); raise exception 'replay CSV aceitou anexo'; exception when sqlstate '55000' then if sqlerrm <> 'origem_xlsx_exige_reconciliacao' then raise; end if; end;
end $$;
reset role;
do $$begin if (select count(*) from pcm.sso_origens_xlsx_cronograma) <> 1 then raise exception 'quantidade de origens divergente'; end if; end$$;
rollback;
