-- Apenas banco sintético dedicado, nunca executar em banco oficial.
\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'sso_transporte_169' THEN RAISE EXCEPTION 'banco_sintetico_obrigatorio'; END IF; END $$;
begin;
update pcm.sso_reconciliacao_cronograma_gate set habilitado=true;
do $$
begin
 begin
  perform pcm.sso_reconciliar_cronograma_por_ator('00000000-0000-0000-0000-000000000099','00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000020',2,'ensaio');
  raise exception 'ator divergente aceito';
 exception when insufficient_privilege then null; end;
 if exists(select 1 from pcm.sso_reconciliacoes_cronograma) then raise exception 'pedido de outro ator executou'; end if;
end $$;
rollback;
