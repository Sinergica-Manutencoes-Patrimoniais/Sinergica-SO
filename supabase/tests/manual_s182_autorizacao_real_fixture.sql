-- Somente banco descartável montado por manual_s182_reserva_rpc_fixture.sql.
\set ON_ERROR_STOP on
do $$ begin if current_database() <> 'sso_s182_descartavel' then raise exception 'banco não descartável'; end if; end $$;
create schema pcm;
create function auth.jwt() returns jsonb language sql stable as $$ select '{"role":"authenticated","user_role":"superadmin"}'::jsonb $$;
create table pcm.clientes(id uuid primary key, ativo boolean not null, deleted_at timestamptz);
create table config.usuarios(user_id uuid primary key, ativo boolean not null, papel text not null);
create table config.sso_acoes(codigo text primary key, modulo text not null, nivel text not null, exige_concessao_individual boolean not null);
create table config.sso_perfis(id uuid primary key, ativo boolean not null);
create table config.sso_usuario_perfis(usuario_id uuid, perfil_id uuid, ativo boolean);
create table config.sso_concessoes(usuario_id uuid, perfil_id uuid, acao text, cliente_id uuid, ativa boolean);
create table config.usuario_modulos(user_id uuid);
create table config.grupos(id uuid);
create table config.grupo_modulos(grupo_id uuid);
create function config.resolver_permissoes_modulo(uuid) returns table(modulo text,nivel text) language sql stable as $$ select null::text,null::text where false $$;
insert into pcm.clientes values('18290000-0000-4000-8000-000000000002',true,null);
insert into config.usuarios values('18290000-0000-4000-8000-000000000001',true,'superadmin');
insert into config.sso_acoes values('faturavel.efetivar','financeiro','escrita',false),('custo.ler','financeiro','leitura',false);
insert into config.sso_concessoes values('18290000-0000-4000-8000-000000000001',null,'faturavel.efetivar','18290000-0000-4000-8000-000000000002',true);
\ir ../migrations/0246_E01-S170_modulos_elegiveis.sql
\ir ../migrations/0319_E01-S170_serializar_permissoes_visita.sql
do $$ begin if not config.sso_autorizar_acao('faturavel.efetivar','18290000-0000-4000-8000-000000000002') then raise exception 'autorização real não configurada'; end if; end $$;
insert into financeiro.itens_faturaveis(id,cliente_id,revisao,status,origem_tipo,origem_id,competencia,valor_conferido_centavos)
values('18290000-0000-4000-8000-000000000035','18290000-0000-4000-8000-000000000002',1,'conferido','teste','18290000-0000-4000-8000-000000000060','2026-11-01',10000);
select financeiro.sso_selecionar_faturavel_documento('18290000-0000-4000-8000-000000000061','18290000-0000-4000-8000-000000000035',1);
