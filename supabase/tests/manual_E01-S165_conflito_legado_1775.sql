-- Apenas clone sintético; executar em transação revertida.
\ir manual_E01-S165_legado_nao_relacionado_1680.sql
set local role authenticated;
do $$ begin
 begin
  perform pcm.sso_classificar_legado_nao_relacionado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000183','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000181',2,repeat('0',64),'Fonte conferida','Revisão');
  raise exception 'fotografia_obsoleta_aceita';
 exception when sqlstate 'P0019' then if sqlerrm <> 'fotografia_obsoleta' then raise;end if; end;
 begin
  perform pcm.sso_prever_legado_nao_relacionado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000181',999);
  raise exception 'revisao_obsoleta_aceita';
 exception when sqlstate 'P0019' then if sqlerrm <> 'plano_ou_revisao_indisponivel' then raise;end if; end;
end $$;
reset role;
