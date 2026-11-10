-- Clone descartável, executar em BEGIN/ROLLBACK.
\ir manual_E01-S165_impacto_calendario_nativo_1704.sql
set local role authenticated;
do $$ declare a jsonb;b jsonb;begin
 begin perform pcm.sso_adicionar_rotina_rascunho_v2('16630000-1111-4000-8000-000000000901',1,'16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000902','Nova rotina','sistema','16630000-1111-4000-8000-000000000033','calendario',1,'meses',current_date,30,0,0,'inspecionar',null,'total');raise exception 'revisao_aceita';exception when sqlstate 'P0011' then null;end;
 a:=pcm.sso_adicionar_rotina_rascunho_v2('16630000-1111-4000-8000-000000000901',2,'16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000902','Nova rotina','sistema','16630000-1111-4000-8000-000000000033','calendario',1,'meses',current_date,30,0,0,'inspecionar',null,'total');
 b:=pcm.sso_adicionar_rotina_rascunho_v2('16630000-1111-4000-8000-000000000901',2,'16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000902','Nova rotina','sistema','16630000-1111-4000-8000-000000000033','calendario',1,'meses',current_date,30,0,0,'inspecionar',null,'total');if a is distinct from b then raise exception 'replay_inclusao_divergente';end if;
 begin perform pcm.sso_retirar_rotina_rascunho('16630000-1111-4000-8000-000000000903',2,'16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000902','fixture');raise exception 'retirada_obsoleta_aceita';exception when sqlstate 'P0011' then null;end;
 a:=pcm.sso_retirar_rotina_rascunho('16630000-1111-4000-8000-000000000903',3,'16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000902','fixture');
 b:=pcm.sso_retirar_rotina_rascunho('16630000-1111-4000-8000-000000000903',3,'16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000902','fixture');if a is distinct from b then raise exception 'replay_retirada_divergente';end if;
end $$;
