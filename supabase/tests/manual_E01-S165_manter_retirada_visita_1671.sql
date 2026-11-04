-- Somente clone descartável com migrations até 1671; executar em BEGIN/ROLLBACK.
-- Fixture inclui selo inserido artificialmente, não testa aprovação real.
\ir manual_E01-S165_S166_continuidade_visita.sql
create temporary table selo_1671 as select * from pcm.sso_continuidades_visita_aprovadas where versao_id='16610000-0000-0000-0000-000000000126';
set local session_replication_role=replica;
update pcm.plano_versoes set snapshot=jsonb_set(snapshot,'{rotinas}','[]'::jsonb) where id='16610000-0000-0000-0000-000000000126';
delete from pcm.sso_continuidades_visita_aprovadas where versao_id='16610000-0000-0000-0000-000000000126';
set local session_replication_role=origin;
do $$ declare p uuid;begin
 select id into p from pcm.ocorrencias_visita_preparadas where plano_id='16610000-0000-0000-0000-000000000121';
 begin perform pcm.sso_exigir_vigencia_ocorrencia_legada('16610000-0000-0000-0000-00000000000a',p,'visita');raise exception 'escopo_retirado_sem_selo_aceito';exception when check_violation then if sqlerrm<>'escopo_retirado_ou_indeterminado' then raise;end if;end;
end; $$;
set local session_replication_role=replica;
insert into pcm.sso_continuidades_visita_aprovadas select * from selo_1671;
set local session_replication_role=origin;
do $$ declare p uuid;begin
 select id into p from pcm.ocorrencias_visita_preparadas where plano_id='16610000-0000-0000-0000-000000000121';
 perform pcm.sso_exigir_vigencia_ocorrencia_legada('16610000-0000-0000-0000-00000000000a',p,'visita');
 if pcm.sso_manter_ocorrencia_escopo_retirado('16610000-0000-0000-0000-00000000000b','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000126',p,'visita','2026-10-09') then raise exception 'cliente_divergente_aceito';end if;
 if pcm.sso_manter_ocorrencia_escopo_retirado('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000126',p,'visita','2026-10-10') then raise exception 'data_divergente_aceita';end if;
 if (select count(*) from pcm.ocorrencias_visita_preparadas where plano_id='16610000-0000-0000-0000-000000000121')<>1 then raise exception 'ocorrencia_duplicada';end if;
 if exists(select 1 from pcm.ordens_servico where client_id='16610000-0000-0000-0000-00000000000a') then raise exception 'os_indevida';end if;
end; $$;
