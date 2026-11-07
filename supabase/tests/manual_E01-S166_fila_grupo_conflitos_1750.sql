-- Somente clone sintético e BEGIN/ROLLBACK.
\ir manual_E01-S166_grupo_fila_afirmacao.sql
set local role authenticated;
do $$ declare v jsonb; begin
 v:=pcm.sso_prever_fila_grupo('17390000-0000-4000-8000-000000000001','17390000-0000-4000-8000-000000000002','17390000-0000-4000-8000-000000000007','17390000-0000-4000-8000-000000000011','calendario');
 begin
  perform pcm.sso_declarar_fila_grupo_confirmado('17390000-0000-4000-8000-000000000001','17390000-0000-4000-8000-000000000029','17390000-0000-4000-8000-000000000002','17390000-0000-4000-8000-000000000007','17390000-0000-4000-8000-000000000011','calendario',999,v->>'fotografiaHash','fonte','motivo',true);
  raise exception 'fotografia_obsoleta_aceita';
 exception when sqlstate 'P0010' then
  if sqlerrm<>'fotografia_ou_fila_alterada' then raise; end if;
 end;
end $$;
