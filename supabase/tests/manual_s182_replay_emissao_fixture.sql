-- Somente banco descartável após manual_s182_replay_revogacao_fixture.sql.
\set ON_ERROR_STOP on
do $$ begin if current_database() <> 'sso_s182_descartavel' then raise exception 'banco não descartável'; end if; end $$;
update config.sso_concessoes set ativa=true where acao='faturavel.efetivar';
alter table financeiro.sso_documentos_internos rename to sso_documentos_internos_teste_base;
create function financeiro.sso_teste_aguardar_documento(uuid) returns boolean language plpgsql volatile as $$
begin perform pg_advisory_xact_lock(182,3); return true; end $$;
create view financeiro.sso_documentos_internos as select * from financeiro.sso_documentos_internos_teste_base where financeiro.sso_teste_aguardar_documento(id);
