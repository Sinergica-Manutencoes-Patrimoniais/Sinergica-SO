-- Clone isolado; envolva em BEGIN/ROLLBACK. Não altera a guarda de aprovação.
\ir manual_E01-S165_visita_futura_1703_setup.sql
set local role authenticated;
do $$ begin
 begin
  perform * from pcm.sso_listar_candidatas_nova_visita(
   '16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a',
   '16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',
   '16610000-0000-0000-0000-000000000161',3,current_date,current_date+30,'{}'::jsonb);
  raise exception 'comparacao_obsoleta_aceita';
 exception when sqlstate 'P0010' then
  if sqlerrm<>'comparacao_obsoleta' then raise; end if;
 end;
end $$;
