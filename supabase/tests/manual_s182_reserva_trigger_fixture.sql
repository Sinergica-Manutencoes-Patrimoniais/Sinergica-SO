-- Somente banco descartável; tabelas simplificadas para exercitar a migration 0730 real.
\set ON_ERROR_STOP on
do $$ begin if current_database() <> 'sso_s182_descartavel' then raise exception 'banco não descartável'; end if; end $$;
create schema financeiro;
create schema auth;
create schema config;
create function auth.uid() returns uuid language sql stable as $$ select '18290000-0000-4000-8000-000000000001'::uuid $$;
create function config.sso_autorizar_acao(text,uuid) returns boolean language sql stable as $$ select true $$;
create table financeiro.itens_faturaveis(id uuid primary key, cliente_id uuid, revisao integer, status text);
create table financeiro.sso_selecoes_documento(id uuid primary key, cliente_id uuid, item_id uuid, revisao_item integer, saldo_centavos bigint, criado_em timestamptz default now());
create table financeiro.sso_documentos_internos(id uuid primary key, item_id uuid, selecao_id uuid, cliente_id uuid, revisao_item integer, valor_centavos bigint, criado_em timestamptz default now(),
  constraint sso_documentos_internos_item_id_key unique(item_id), constraint sso_documentos_internos_selecao_id_key unique(selecao_id));
create table financeiro.sso_documentos_internos_liberacoes(request_id uuid primary key, documento_interno_id uuid unique, acao text);
create table financeiro.sso_selecao_documento_gate(id boolean primary key, habilitado boolean);
create table financeiro.sso_documento_interno_gate(id boolean primary key, habilitado boolean);
\ir ../migrations/0730_E01-S182_parcelas_sequenciais.sql
insert into financeiro.itens_faturaveis(id) values ('18290000-0000-4000-8000-000000000031');
