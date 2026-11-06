-- Clone descartável com migrations até 1704, BEGIN/ROLLBACK; 1045 inalterada.
\ir manual_E01-S165_nova_data_futura_1702.sql
reset role;
update config.sso_concessoes set ativa=true where usuario_id='16630000-1111-4000-8000-000000000001' and acao='plano.gerir';
do $$ declare r jsonb;begin
 r:=pcm.sso_avaliar_decisoes_impacto('16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',3);
 if (r->>'fontesIndividuaisIncompletas')::integer<>0 then raise exception 'nativo_canonico_bloqueado: %',r;end if;
end; $$;
create temporary table identidade_1704 as select cv.* from pcm.sso_ciclo_calendario_versoes cv join pcm.ocorrencias_rotina_preparadas o on o.id=cv.preparada_id where o.plano_id='16630000-1111-4000-8000-000000000011';
set local session_replication_role=replica;
delete from pcm.sso_ciclo_calendario_versoes where preparada_id in (select preparada_id from identidade_1704);
set local session_replication_role=origin;
do $$ declare r jsonb;begin
 r:=pcm.sso_avaliar_decisoes_impacto('16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',3);
 if (r->>'fontesIndividuaisIncompletas')::integer<>1 then raise exception 'identidade_ausente_aceita: %',r;end if;
end; $$;
set local session_replication_role=replica;
insert into pcm.sso_ciclo_calendario_versoes select * from identidade_1704;
insert into pcm.planos_preventivos(id,cliente_id,sistema_id,questionario_id,tipo_tarefa_id,nome,primeira_data,intervalo_unidade,intervalo_n,estado,created_by)
values('16630000-1111-4000-8000-000000000704','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000033','16630000-1111-4000-8000-000000000705','16630000-1111-4000-8000-000000000706','Legado desconhecido',current_date,'meses',1,'ativo','16630000-1111-4000-8000-000000000001');
set local session_replication_role=origin;
do $$ declare r jsonb;begin
 r:=pcm.sso_avaliar_fontes_impacto_visita_legado('16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',3);
 if (r->>'planosClienteSemRelacaoDeclarada')::integer<>1 then raise exception 'legado_nao_classificado_ignorado: %',r;end if;
end; $$;
