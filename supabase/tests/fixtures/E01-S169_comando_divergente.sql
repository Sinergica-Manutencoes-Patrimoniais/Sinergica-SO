-- Apenas banco sintético dedicado, nunca executar em banco oficial.
DO $$ BEGIN IF current_database() <> 'sso_transporte_169' THEN RAISE EXCEPTION 'banco_sintetico_obrigatorio'; END IF; END $$;
\set ON_ERROR_STOP on
begin;
update pcm.sso_reconciliacao_cronograma_gate set habilitado=true;
do $$
begin
  begin
    perform pcm.sso_reconciliar_cronograma_conferido('00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000020',2,'ensaio');
    raise exception 'comando incompleto aceito';
  exception when check_violation then null; end;
end $$;
rollback;
