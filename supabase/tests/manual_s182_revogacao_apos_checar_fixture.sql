-- Somente depois de manual_s182_reserva_rpc_fixture.sql em banco descartável.
\set ON_ERROR_STOP on
do $$ begin if current_database() <> 'sso_s182_descartavel' then raise exception 'banco não descartável'; end if; end $$;
update config.autorizacao_teste set habilitada=true;
insert into financeiro.itens_faturaveis(id,cliente_id,revisao,status,origem_tipo,origem_id,competencia,valor_conferido_centavos)
values('18290000-0000-4000-8000-000000000034','18290000-0000-4000-8000-000000000002',1,'conferido','teste','18290000-0000-4000-8000-000000000048','2026-11-01',10000);
select financeiro.sso_selecionar_faturavel_documento('18290000-0000-4000-8000-000000000049','18290000-0000-4000-8000-000000000034',1);
-- Barreira sintética após autorização; apenas para reproduzir a ordem da corrida.
create function financeiro.sso_teste_barreira_revogacao() returns trigger language plpgsql as $$
begin perform pg_advisory_xact_lock(182,1); return new; end $$;
create trigger sso_teste_barreira before insert on financeiro.sso_documentos_internos for each row execute function financeiro.sso_teste_barreira_revogacao();
