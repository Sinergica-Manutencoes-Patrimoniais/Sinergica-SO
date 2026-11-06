-- Clone descartável, executar em BEGIN/ROLLBACK.
\ir manual_E01-S165_impacto_calendario_nativo_1704.sql
reset role;
update pcm.sso_pmoc_mediado_gate set habilitado=true where id;
update pcm.sso_diagnostico_pmoc_gate set habilitado=true where id;
update pcm.sso_vinculo_ciclo_pmoc_gate set habilitado=true where id;
set local role authenticated;
do $$ begin
 begin perform pcm.sso_listar_impactos_pmoc_revisao('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',1,null,20);raise exception 'lista_aceitou_revisao';exception when sqlstate 'P0011' then null;end;
 begin perform pcm.sso_avaliar_impacto_pmoc('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',1);raise exception 'avaliacao_aceitou_revisao';exception when sqlstate 'P0011' then null;end;
 begin perform pcm.sso_decidir_impacto_pmoc('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000909','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022','16630000-1111-4000-8000-000000000999',1,0,'exige_reconciliacao','fixture','{}');raise exception 'decisao_aceitou_revisao';exception when sqlstate 'P0011' then null;end;
end $$;
