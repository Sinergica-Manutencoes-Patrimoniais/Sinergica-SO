-- Apenas clone descartável, migrations até 1687; executar em BEGIN/ROLLBACK.
-- Selo artificial: não testa aprovação nem autoriza habilitar 1045.
\ir manual_E01-S165_S166_continuidade_calendario.sql
reset role;
do $$ declare p uuid;r jsonb;begin
 select id into p from pcm.ocorrencias_rotina_preparadas where plano_id='16630000-1111-4000-8000-000000000011';
 r:=pcm.sso_versao_operacional_ciclo('16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',p,'calendario');
 if r->>'versaoId'<>'16630000-1111-4000-8000-000000000021' or r->>'rotinaId'<>'16630000-1111-4000-8000-000000000031' then raise exception 'origem_incorreta: %',r;end if;
 begin perform pcm.sso_versao_operacional_ciclo('16630000-1111-4000-8000-00000000000b','16630000-1111-4000-8000-000000000011',p,'calendario');raise exception 'cliente_divergente_aceito';exception when insufficient_privilege then null;end;
end; $$;
insert into pcm.sso_versoes_operacionais_ciclo(tipo,cliente_id,plano_id,preparada_id,versao_id,rotina_id,vigencia,decisao_request_id)
select 'calendario','16630000-1111-4000-8000-00000000000a',o.plano_id,o.id,'16630000-1111-4000-8000-000000000022','16630000-1111-4000-8000-000000000034',current_date,'16630000-1111-4000-8000-000000000092'
from pcm.ocorrencias_rotina_preparadas o where o.plano_id='16630000-1111-4000-8000-000000000011';
do $$ declare p uuid;r jsonb;begin
 select id into p from pcm.ocorrencias_rotina_preparadas where plano_id='16630000-1111-4000-8000-000000000011';
 r:=pcm.sso_versao_operacional_ciclo('16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',p,'calendario');
 if r->>'versaoId'<>'16630000-1111-4000-8000-000000000022' or r->>'rotinaId'<>'16630000-1111-4000-8000-000000000034' then raise exception 'versao_efetiva_incorreta: %',r;end if;
 if (select versao_id from pcm.ocorrencias_rotina_preparadas where id=p)<>'16630000-1111-4000-8000-000000000021'::uuid then raise exception 'origem_alterada';end if;
end; $$;
