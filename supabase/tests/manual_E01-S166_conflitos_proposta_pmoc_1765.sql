-- Clone descartável com migrations até 1767; BEGIN/ROLLBACK obrigatório.
\ir manual_E01-S165_impacto_calendario_nativo_1704.sql
reset role;
set local session_replication_role=replica;
update pcm.plano_versoes set snapshot=jsonb_set(snapshot,'{rotinas,0,alvo}','{"tipo":"sistema","id":"16630000-1111-4000-8000-000000000033"}'::jsonb) where id='16630000-1111-4000-8000-000000000021';
set local session_replication_role=origin;
set local role authenticated;
do $$ declare a jsonb;b jsonb;p uuid;begin
 begin perform pcm.sso_propor_pmoc_mediado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000701','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',1,'16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',current_date,'16630000-1111-4000-8000-000000000043','conferido');raise exception 'proposta_revisao_aceita';exception when sqlstate 'P0011' then null;end;
 a:=pcm.sso_propor_pmoc_mediado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000701','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',2,'16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',current_date,'16630000-1111-4000-8000-000000000043','conferido');
 b:=pcm.sso_propor_pmoc_mediado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000701','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',2,'16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',current_date,'16630000-1111-4000-8000-000000000043','conferido');if a is distinct from b then raise exception 'replay_proposta_divergente';end if;p:=(a->>'propostaId')::uuid;
 begin perform pcm.sso_decidir_pmoc_mediado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000702','16630000-1111-4000-8000-00000000000a',p,1,'rejeitada','fonte','conferido');raise exception 'decisao_revisao_aceita';exception when sqlstate 'P0011' then null;end;
 a:=pcm.sso_decidir_pmoc_mediado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000702','16630000-1111-4000-8000-00000000000a',p,0,'rejeitada','fonte','conferido');
 b:=pcm.sso_decidir_pmoc_mediado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000702','16630000-1111-4000-8000-00000000000a',p,0,'rejeitada','fonte','conferido');if a is distinct from b then raise exception 'replay_decisao_divergente';end if;
end $$;
reset role;
create temporary table proposta_1765 as select id from pcm.sso_propostas_mapeamento_pmoc where request_id='16630000-1111-4000-8000-000000000701';
grant select on proposta_1765 to authenticated;
set local session_replication_role=replica;
update pcm.planos_manutencao set revisao=3 where id='16630000-1111-4000-8000-000000000011';
set local session_replication_role=origin;
set local role authenticated;
do $$ declare p uuid;begin
 select id into p from proposta_1765;
 begin perform pcm.sso_decidir_pmoc_mediado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000703','16630000-1111-4000-8000-00000000000a',p,1,'rejeitada','fonte','conferido');raise exception 'plano_alterado_aceito';exception when sqlstate 'P0017' then null;end;
end $$;
