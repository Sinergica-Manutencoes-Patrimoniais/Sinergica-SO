-- Clone descartável com migrations até 1789. Executar em BEGIN/ROLLBACK.
-- A fixture prepara uma Visita sintética pela API canônica; seu núcleo privado
-- grava um recibo anterior com request próprio, usado apenas como dado de ensaio.
\ir manual_E01-S166_fila_visita_fixture.sql
reset role;
create temporary table recibo_1789 as
 select request_id,actor_id,cliente_id,payload,resultado
 from pcm.calendario_contratual_comandos
 where payload->>'tipo'='prepararOcorrenciaVisita'
   and cliente_id='16610000-0000-0000-0000-00000000000a';
do $$ begin if (select count(*) from recibo_1789)<>1 then raise exception 'fixture_recibo_ambiguo';end if;end $$;
grant select on recibo_1789 to authenticated;
create temporary table baseline_recibo_1789 as select
 (select count(*) from pcm.ocorrencias_visita_preparadas) ocorrencias,
 (select count(*) from pcm.calendario_contratual_comandos) comandos,
 (select count(*) from pcm.ordens_servico) ordens,
 (select count(*) from pcm.auvo_sync_outbox) outbox,
 (select count(*) from audit.events) auditoria;
set local role authenticated;
do $$ declare x record;a jsonb;b jsonb;ausente jsonb;begin
 select * into x from recibo_1789;
 a:=pcm.sso_consultar_recibo_preparacao_visita_anterior(x.actor_id,x.cliente_id,x.request_id,(x.payload->>'ocorrenciaId')::uuid,(x.payload->>'planoId')::uuid,(x.payload->>'versaoId')::uuid,(x.payload->>'rotinaId')::uuid,(x.payload->>'visitaId')::uuid,(x.payload->>'expectedRevision')::integer,x.payload->>'fonteDiaUtil');
 b:=pcm.sso_consultar_recibo_preparacao_visita_anterior(x.actor_id,x.cliente_id,x.request_id,(x.payload->>'ocorrenciaId')::uuid,(x.payload->>'planoId')::uuid,(x.payload->>'versaoId')::uuid,(x.payload->>'rotinaId')::uuid,(x.payload->>'visitaId')::uuid,(x.payload->>'expectedRevision')::integer,x.payload->>'fonteDiaUtil');
 if a is distinct from b or a->>'encontrado'<>'true' or a->'resultado' is distinct from x.resultado then raise exception 'recibo_ou_replay_divergente';end if;
 ausente:=pcm.sso_consultar_recibo_preparacao_visita_anterior(x.actor_id,x.cliente_id,'17890000-0000-4000-8000-000000000001',(x.payload->>'ocorrenciaId')::uuid,(x.payload->>'planoId')::uuid,(x.payload->>'versaoId')::uuid,(x.payload->>'rotinaId')::uuid,(x.payload->>'visitaId')::uuid,(x.payload->>'expectedRevision')::integer,x.payload->>'fonteDiaUtil');
 if ausente is distinct from '{"encontrado":false}'::jsonb then raise exception 'ausencia_nao_indeterminada';end if;
 begin perform pcm.sso_consultar_recibo_preparacao_visita_anterior(x.actor_id,x.cliente_id,x.request_id,(x.payload->>'ocorrenciaId')::uuid,(x.payload->>'planoId')::uuid,(x.payload->>'versaoId')::uuid,(x.payload->>'rotinaId')::uuid,(x.payload->>'visitaId')::uuid,(x.payload->>'expectedRevision')::integer,'fonte divergente');raise exception 'payload_divergente_aceito';exception when insufficient_privilege then null;end;
 begin perform pcm.sso_consultar_recibo_preparacao_visita_anterior('16610000-0000-0000-0000-000000000002',x.cliente_id,x.request_id,(x.payload->>'ocorrenciaId')::uuid,(x.payload->>'planoId')::uuid,(x.payload->>'versaoId')::uuid,(x.payload->>'rotinaId')::uuid,(x.payload->>'visitaId')::uuid,(x.payload->>'expectedRevision')::integer,x.payload->>'fonteDiaUtil');raise exception 'ator_divergente_aceito';exception when insufficient_privilege then null;end;
 begin perform pcm.sso_consultar_recibo_preparacao_visita_anterior(x.actor_id,'16610000-0000-0000-0000-00000000000b',x.request_id,(x.payload->>'ocorrenciaId')::uuid,(x.payload->>'planoId')::uuid,(x.payload->>'versaoId')::uuid,(x.payload->>'rotinaId')::uuid,(x.payload->>'visitaId')::uuid,(x.payload->>'expectedRevision')::integer,x.payload->>'fonteDiaUtil');raise exception 'cliente_divergente_aceito';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ declare b record;begin
 select * into b from baseline_recibo_1789;
 if b.ocorrencias<>(select count(*) from pcm.ocorrencias_visita_preparadas) or b.comandos<>(select count(*) from pcm.calendario_contratual_comandos) or b.ordens<>(select count(*) from pcm.ordens_servico) or b.outbox<>(select count(*) from pcm.auvo_sync_outbox) or b.auditoria<>(select count(*) from audit.events) then raise exception 'consulta_produziu_efeito';end if;
 if has_function_privilege('anon','pcm.sso_consultar_recibo_preparacao_visita_anterior(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,text)','execute') then raise exception 'acl_anon_indevida';end if;
end $$;
