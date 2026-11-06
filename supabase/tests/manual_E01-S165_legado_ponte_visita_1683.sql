-- Somente clone descartável; executar em BEGIN/ROLLBACK com migrations até 1683.
\ir manual_E01-S165_S166_ponte_visita_mediada.sql
set local role authenticated;
do $$ begin
 perform pcm.sso_declarar_relacao_legada_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000183','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000145',1,'retirar','Teste de ponte Visita preservada');
 begin
  perform pcm.sso_prever_legado_nao_relacionado('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000145',2);
  raise exception 'ponte_visita_ignorada';
 exception when check_violation then if sqlerrm<>'ponte_legada_existente' then raise;end if;end;
end; $$;
reset role;
