-- Somente clone descartável e BEGIN/ROLLBACK.
\ir manual_E01-S166_grupo_fila_afirmacao.sql
set local role authenticated;
do $$ begin
 begin
  perform pcm.sso_confirmar_fila_preventiva('17390000-0000-4000-8000-000000000029','17390000-0000-4000-8000-000000000002','17390000-0000-4000-8000-000000000007','17390000-0000-4000-8000-000000000011',1,'revisão antiga');
  raise exception 'revisao_antiga_aceita';
 exception when sqlstate 'P0012' then
  if sqlerrm<>'fila_ou_revisao_indisponivel' then raise; end if;
 end;
end $$;
