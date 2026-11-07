\set ON_ERROR_STOP on
do $$begin if current_database() <> 'sso_s169_descartavel' then raise exception 'banco nao descartavel'; end if; end$$;
begin;
-- Simula uma alteração de permissão segurando a mesma trava exclusiva da 0319.
select pg_advisory_xact_lock(hashtextextended('sso-autorizacao-confirmacao-visita',0));
update config.permissao_teste set habilitada=false;
select pg_sleep(8);
commit;
