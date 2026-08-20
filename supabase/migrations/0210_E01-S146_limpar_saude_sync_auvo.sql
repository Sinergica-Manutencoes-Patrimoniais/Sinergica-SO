-- 0210_E01-S146_limpar_saude_sync_auvo.sql — Sinérgica SO
-- Story E01-S146. Investigação: "591 erros" em auvo_sync_health não era falha de integração —
-- 568/591 (96%) eram linhas do outbox apontando para row_id já deletado de pcm.clientes/
-- equipamentos/ferramentas (hard-delete anterior a esta story, sem relação com o motor de sync;
-- o motor nunca reprocessa `status='error'` — fn_claim_auvo_outbox_batch só reivindica
-- `status='pending'` — por isso ficavam acumuladas para sempre). 8 linhas eram
-- `writeEnabled=false, pulado (dry-run)` (produto_categorias/serviços/sistemas, E01-S47 ainda não
-- habilitou escrita para essas entidades) contadas como "erro" por engano. 1 linha era
-- "descriptor desconhecido" de antes do descriptor de `sistemas` existir no registry.

-- 1) Purga linhas do outbox cujo row_id de origem não existe mais na tabela PCM correspondente —
--    nunca vão suceder (fetchOrigem em pcm-auvo-push/index.ts não filtra deleted_at; se não achou,
--    é hard-delete real, não soft-delete). Revalida contra o estado atual da tabela, não confia só
--    no texto de `last_error` já gravado.
delete from pcm.auvo_sync_outbox o
where o.status = 'error'
  and o.entity = 'clientes'
  and not exists (select 1 from pcm.clientes c where c.id = o.row_id);

delete from pcm.auvo_sync_outbox o
where o.status = 'error'
  and o.entity = 'equipamentos'
  and o.last_error like 'linha de origem % não encontrada em pcm.equipamentos'
  and not exists (select 1 from pcm.equipamentos e where e.id = o.row_id);

delete from pcm.auvo_sync_outbox o
where o.status = 'error'
  and o.entity = 'ferramentas'
  and not exists (select 1 from pcm.ferramentas f where f.id = o.row_id);

-- 2) A linha de `sistemas` marcada "descriptor desconhecido" é anterior ao registro do descriptor
--    no registry (já existe hoje, writeEnabled:false — ADR-0009/D2). Reabre como pendente para o
--    próximo drain classificar certo (vira dry-run pulado, não mais um erro de descriptor ausente).
update pcm.auvo_sync_outbox
set status = 'pending', last_error = null
where entity = 'sistemas'
  and status = 'error'
  and last_error = 'descriptor desconhecido para entity="sistemas"';

-- 3) `writeEnabled=false, pulado (dry-run)` é comportamento esperado (AC-6 de pcm-auvo-push), não
--    falha real — para de contar essas linhas como erro na saúde de sync visível na UI.
create or replace view pcm.auvo_sync_health as
 select coalesce(s.entity, o.entity) as entity,
    s.write_enabled,
    s.updated_at as write_enabled_checked_at,
    max(o.sent_at) filter (where o.status = 'sent'::text) as last_push_ok_at,
    s.last_pull_ok_at,
    greatest(s.last_error_at, max(o.enqueued_at) filter (where o.status = 'error'::text and o.last_error is distinct from 'writeEnabled=false, pulado (dry-run)')) as last_error_at,
        case
            when s.last_error_at >= coalesce(max(o.enqueued_at) filter (where o.status = 'error'::text and o.last_error is distinct from 'writeEnabled=false, pulado (dry-run)'), '-infinity'::timestamp with time zone) then s.last_error
            else (array_agg(o.last_error order by o.enqueued_at desc) filter (where o.status = 'error'::text and o.last_error is distinct from 'writeEnabled=false, pulado (dry-run)'))[1]
        end as last_error,
    count(*) filter (where o.status = 'pending'::text) as push_pending_count,
    count(*) filter (where o.status = 'error'::text and o.last_error is distinct from 'writeEnabled=false, pulado (dry-run)') as push_error_count
   from pcm.auvo_entity_status s
     full join pcm.auvo_sync_outbox o on o.entity = s.entity
  where (auth.jwt() ->> 'user_role'::text) = 'superadmin'::text or (((auth.jwt() -> 'user_modulos'::text) ->> 'pcm'::text) = any (array['leitura'::text, 'escrita'::text]))
  group by (coalesce(s.entity, o.entity)), s.write_enabled, s.updated_at, s.last_pull_ok_at, s.last_error_at, s.last_error;

create or replace view pcm.auvo_sync_error_details as
 with ultimo_evento_por_registro as (
         select distinct on (auvo_sync_outbox.entity, auvo_sync_outbox.row_id) auvo_sync_outbox.entity,
            auvo_sync_outbox.row_id,
            auvo_sync_outbox.status,
            auvo_sync_outbox.last_error,
            auvo_sync_outbox.enqueued_at
           from pcm.auvo_sync_outbox
          order by auvo_sync_outbox.entity, auvo_sync_outbox.row_id, auvo_sync_outbox.enqueued_at desc, auvo_sync_outbox.id desc
        ), erros_outbox as (
         select ultimo_evento_por_registro.entity,
            ultimo_evento_por_registro.row_id,
                case
                    when ultimo_evento_por_registro.last_error is null or btrim(ultimo_evento_por_registro.last_error) = ''::text then 'Falha de sincronização sem detalhe.'::text
                    when ultimo_evento_por_registro.last_error ~* '(authorization|bearer|api[_ -]?key|token|secret|senha|password)'::text then 'Detalhe técnico protegido. Consulte os logs de sincronização.'::text
                    when ultimo_evento_por_registro.last_error ~ '[\r\n]'::text or ultimo_evento_por_registro.last_error ~* '(^|[[:space:]])at[[:space:]].*\('::text then 'Falha técnica de sincronização. Consulte os logs de sincronização.'::text
                    else "left"(regexp_replace(ultimo_evento_por_registro.last_error, '[[:space:]]+'::text, ' '::text, 'g'::text), 500)
                end as last_error,
            ultimo_evento_por_registro.enqueued_at as last_error_at
           from ultimo_evento_por_registro
          where ultimo_evento_por_registro.status = 'error'::text
            and ultimo_evento_por_registro.last_error is distinct from 'writeEnabled=false, pulado (dry-run)'
        ), erros_pull as (
         select auvo_entity_status.entity,
            null::uuid as row_id,
                case
                    when auvo_entity_status.last_error ~* '(authorization|bearer|api[_ -]?key|token|secret|senha|password)'::text then 'Detalhe técnico protegido. Consulte os logs de sincronização.'::text
                    when auvo_entity_status.last_error ~ '[\r\n]'::text or auvo_entity_status.last_error ~* '(^|[[:space:]])at[[:space:]].*\('::text then 'Falha técnica de sincronização. Consulte os logs de sincronização.'::text
                    else "left"(regexp_replace(auvo_entity_status.last_error, '[[:space:]]+'::text, ' '::text, 'g'::text), 500)
                end as last_error,
            auvo_entity_status.last_error_at
           from pcm.auvo_entity_status
          where auvo_entity_status.last_error is not null and btrim(auvo_entity_status.last_error) <> ''::text
        )
 select entity,
    row_id,
    last_error,
    last_error_at
   from ( select erros_outbox.entity,
            erros_outbox.row_id,
            erros_outbox.last_error,
            erros_outbox.last_error_at
           from erros_outbox
        union all
         select erros_pull.entity,
            erros_pull.row_id,
            erros_pull.last_error,
            erros_pull.last_error_at
           from erros_pull) erros
  where (auth.jwt() ->> 'user_role'::text) = 'superadmin'::text or (((auth.jwt() -> 'user_modulos'::text) ->> 'pcm'::text) = any (array['leitura'::text, 'escrita'::text]));
