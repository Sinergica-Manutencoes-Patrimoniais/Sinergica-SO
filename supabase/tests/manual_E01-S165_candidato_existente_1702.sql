-- Clone descartável, BEGIN/ROLLBACK. Candidato sintético já existente impede escolha e selo.
\ir manual_E01-S165_nova_data_futura_1702.sql
reset role;
update config.sso_concessoes set ativa=true where usuario_id='16630000-1111-4000-8000-000000000001' and acao='plano.gerir';
set local session_replication_role=replica;
insert into pcm.ocorrencias_rotina_preparadas(id,plano_id,versao_id,rotina_id,rotina_logica_id,alvo_tipo,alvo_id,ciclo,vencimento_original,tolerancia_antes,tolerancia_depois,created_by)
select '16630000-1111-4000-8000-000000000718',o.plano_id,'16630000-1111-4000-8000-000000000022',o.rotina_id,o.rotina_logica_id,o.alvo_tipo,o.alvo_id,0,current_date+11,o.tolerancia_antes,o.tolerancia_depois,o.created_by
from pcm.ocorrencias_rotina_preparadas o where o.plano_id='16630000-1111-4000-8000-000000000011';
set local session_replication_role=origin;
do $$ declare p uuid;f jsonb;begin
 if pcm.sso_escolha_nova_data_calendario_atual('16630000-1111-4000-8000-000000000702','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',3) then raise exception 'candidato_existente_ignorado';end if;
 select id into p from pcm.ocorrencias_rotina_preparadas where plano_id='16630000-1111-4000-8000-000000000011' and vencimento_original=current_date+10;
 f:=pcm.sso_comparar_rotina_impacto_v3('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',3,'16630000-1111-4000-8000-000000000022',p,'calendario');
 begin perform pcm.sso_escolher_nova_data_calendario('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000719','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,3,2,0,current_date+11,'Teste',f);raise exception 'candidato_existente_aceito';exception when check_violation then if sqlerrm<>'candidato_existente_exige_reconciliacao' then raise;end if;end;
end; $$;
