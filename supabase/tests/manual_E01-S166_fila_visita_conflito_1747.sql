-- Executar somente em clone descartável, dentro de BEGIN/ROLLBACK.
\ir manual_E01-S166_fila_visita_fixture.sql
reset role;
update pcm.sso_fila_visita_gate set habilitado=true where id;
set local role authenticated;
do $$ declare a jsonb; b jsonb; begin
 a:=pcm.sso_alterar_fila_visita('16610000-0000-0000-0000-000000000191','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000161','incluir',0,'fonte conferida');
 begin
  perform pcm.sso_alterar_fila_visita('16610000-0000-0000-0000-000000000192','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000161','cancelar',999,'cancelamento');
  raise exception 'revisao_obsoleta_aceita';
 exception when sqlstate 'P0012' then
  if sqlerrm<>'fila_ou_revisao_indisponivel' then raise; end if;
 end;
 b:=pcm.sso_alterar_fila_visita('16610000-0000-0000-0000-000000000191','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000161','incluir',0,'fonte conferida');
 if a is distinct from b then raise exception 'replay_divergente'; end if;
end $$;
