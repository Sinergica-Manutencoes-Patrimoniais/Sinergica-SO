-- Somente clone descartável com migrations até 1671; executar em BEGIN/ROLLBACK.
-- Fixture inclui selo inserido artificialmente, não testa aprovação real.
\ir manual_E01-S165_S166_continuidade_calendario.sql
create temporary table selo_1671 as select * from pcm.sso_continuidades_ciclo_aprovadas where versao_id='16630000-1111-4000-8000-000000000022';
set local session_replication_role=replica;
update pcm.plano_versoes set snapshot=jsonb_set(snapshot,'{rotinas}','[]'::jsonb) where id='16630000-1111-4000-8000-000000000022';
delete from pcm.sso_continuidades_ciclo_aprovadas where versao_id='16630000-1111-4000-8000-000000000022';
set local session_replication_role=origin;
do $$ declare p uuid;begin
 select id into p from pcm.ocorrencias_rotina_preparadas where plano_id='16630000-1111-4000-8000-000000000011';
 begin perform pcm.sso_exigir_vigencia_ocorrencia_legada('16630000-1111-4000-8000-00000000000a',p,'calendario');raise exception 'escopo_retirado_sem_selo_aceito';exception when check_violation then if sqlerrm<>'escopo_retirado_ou_indeterminado' then raise;end if;end;
end; $$;
set local session_replication_role=replica;
insert into pcm.sso_continuidades_ciclo_aprovadas select * from selo_1671;
set local session_replication_role=origin;
do $$ declare p uuid;begin
 select id into p from pcm.ocorrencias_rotina_preparadas where plano_id='16630000-1111-4000-8000-000000000011';
 perform pcm.sso_exigir_vigencia_ocorrencia_legada('16630000-1111-4000-8000-00000000000a',p,'calendario');
 if pcm.sso_manter_ocorrencia_escopo_retirado('16630000-1111-4000-8000-00000000000b','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,'calendario',current_date) then raise exception 'cliente_divergente_aceito';end if;
 if pcm.sso_manter_ocorrencia_escopo_retirado('16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,'calendario',current_date+1) then raise exception 'data_divergente_aceita';end if;
 if (select count(*) from pcm.ocorrencias_rotina_preparadas where plano_id='16630000-1111-4000-8000-000000000011')<>1 then raise exception 'ocorrencia_duplicada';end if;
 if exists(select 1 from pcm.ordens_servico where client_id='16630000-1111-4000-8000-00000000000a') then raise exception 'os_indevida';end if;
end; $$;
set local role authenticated;
do $$ begin
 begin perform * from pcm.sso_prever_ciclos_rotina('16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022','16630000-1111-4000-8000-000000000034',current_date,current_date);raise exception 'nova_rotina_retirada_aceita';exception when check_violation then if sqlerrm<>'rotina_calendario_indisponivel' then raise;end if;end;
end; $$;
reset role;
