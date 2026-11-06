-- ADR-0892: diagnóstico somente leitura. Executar via psql como operador autorizado.
-- Não contém matriz, observações ou payloads; não certifica segurança de migração.
\set ON_ERROR_STOP on
begin transaction read only;

with lotes as (
  select l.*,
    case when jsonb_typeof(l.matriz) = 'array' then jsonb_array_length(l.matriz) end as linhas
  from pcm.cronograma_importacao_lotes l
), diagnostico as (
  select l.id as lote_id, l.cliente_id, l.revisao, l.linhas,
    l.fonte_id <> btrim(l.fonte_id) or length(l.fonte_id) not between 1 and 188 as fonte_incompativel,
    l.linhas is null or l.linhas not between 5 and 10000 or octet_length(l.matriz::text) > 1048576
      or exists (
        select 1 from jsonb_array_elements(case when l.linhas is null then '[]'::jsonb else l.matriz end) linha
        where case when jsonb_typeof(linha) <> 'array' then true else
          jsonb_array_length(linha) > 500 or exists (
            select 1 from jsonb_array_elements(linha) celula
            where jsonb_typeof(celula) not in ('string','number','boolean','null')
              or octet_length(celula::text) > 4000
          ) end
      ) as matriz_incompativel,
    not exists (select 1 from config.usuarios u where u.user_id = l.criado_por) as criador_sem_cadastro,
    exists (select 1 from pcm.sso_levantamentos d where d.id = l.id) as id_ocupado,
    exists (select 1 from pcm.sso_levantamentos d where d.cliente_id = l.cliente_id
      and d.origem = 'planilha' and d.chave_origem = 'cronograma:' || l.fonte_id) as origem_ocupada,
    (select count(*) from pcm.cronograma_importacao_revisoes r where r.lote_id = l.id) <> l.revisao - 1
      or exists (select 1 from pcm.cronograma_importacao_revisoes r where r.lote_id = l.id
        and (r.revisao > l.revisao or r.numero_linha > coalesce(l.linhas, 0))) as revisoes_inconsistentes,
    exists (select 1 from pcm.cronograma_importacao_revisoes r where r.lote_id = l.id
      and not exists (select 1 from config.usuarios u where u.user_id = r.ator_id)) as revisor_sem_cadastro,
    exists (select 1 from pcm.cronograma_importacao_revisoes r
      join pcm.sso_levantamento_conferencias c on c.id = r.id where r.lote_id = l.id) as id_revisao_ocupado,
    exists (select 1 from pcm.cronograma_importacao_comandos c
      join pcm.sso_levantamento_comandos d on d.request_id = c.request_id
      where c.payload->>'loteId' = l.id::text or c.resultado->>'aggregateId' = l.id::text) as request_id_ocupado,
    exists (select 1 from pcm.cronograma_importacao_comandos c
      where (c.payload->>'loteId' = l.id::text or c.resultado->>'aggregateId' = l.id::text)
        and (c.cliente_id is distinct from l.cliente_id
          or c.payload->>'loteId' is distinct from l.id::text
          or c.resultado->>'aggregateId' is distinct from l.id::text
          or not exists (select 1 from config.usuarios u where u.user_id = c.ator_id))) as comando_inconsistente
  from lotes l
)
select * from diagnostico order by cliente_id, lote_id;

-- Inclui comandos sem lote conhecido ou com referências divergentes. Não lista payload.
select count(*) as comandos_sem_vinculo_inequivoco
from pcm.cronograma_importacao_comandos c
where not exists (
  select 1 from pcm.cronograma_importacao_lotes l
  where c.payload->>'loteId' = l.id::text and c.resultado->>'aggregateId' = l.id::text
    and c.cliente_id = l.cliente_id
);
rollback;
