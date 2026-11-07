-- Somente clone descartável; executar em BEGIN/ROLLBACK com migrations até 1683.
\ir manual_E01-S165_legado_nao_relacionado_1680.sql
set local role authenticated;
do $$ begin
 perform pcm.sso_declarar_relacao_legada_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000183','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000097',1,'retirar','Teste de ponte preservada');
 begin
  perform pcm.sso_prever_legado_nao_relacionado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000097',2);
  raise exception 'ponte_legada_ignorada';
 exception when check_violation then if sqlerrm<>'ponte_legada_existente' then raise;end if;end;
end; $$;
reset role;
