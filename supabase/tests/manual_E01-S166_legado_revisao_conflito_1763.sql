-- Somente clone isolado, BEGIN/ROLLBACK.
\ir manual_E01-S165_S166_ponte_visita_mediada.sql
set local role authenticated;
do $$ begin
 begin
  perform pcm.sso_declarar_relacao_legada_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000943','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000145',999,'declarar','relação conferida');
  raise exception 'revisao_incorreta_aceita';
 exception when sqlstate 'P0011' then
  if sqlerrm<>'revisao_obsoleta' then raise; end if;
 end;
end $$;
reset role;
update pcm.sso_lote_ciclos_legados_gate set habilitado=true where id;
set local role authenticated;
do $$ begin
 begin
  perform pcm.sso_lote_legado_mediado('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000944','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000145','16610000-0000-0000-0000-000000000146',999,array['16610000-0000-0000-0000-000000000161'::uuid],'conferido');
  raise exception 'revisao_lote_aceita';
 exception when sqlstate 'P0011' then
  if sqlerrm<>'revisao_obsoleta' then raise; end if;
 end;
end $$;
