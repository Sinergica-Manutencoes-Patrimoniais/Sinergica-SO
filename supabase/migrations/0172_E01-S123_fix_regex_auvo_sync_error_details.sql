-- 0172_E01-S123_fix_regex_auvo_sync_error_details.sql — Sinérgica SO
-- Fix: 0166 define a view com um padrão regex que nunca funcionou em produção.
-- `'...\\('` dentro de uma string plain (não `E'...'`, standard_conforming_strings=on) NÃO tem
-- `\\` interpretado como escape — vira dois caracteres `\` literais seguidos de `(` não-escapado,
-- que abre um grupo de captura nunca fechado: "invalid regular expression: parentheses () not
-- balanced". Achado ao rodar o pgTAP real pela primeira vez (CI, `db-tests`) — nenhuma sessão
-- anterior tinha Docker disponível pra executar esses testes contra o Postgres de verdade.
-- Fix: um único `\(` (a string plain já não escapa barra — um `\` basta pra virar o regex `\(`,
-- que casa um parêntese literal).

create or replace view pcm.auvo_sync_error_details as
with ultimo_evento_por_registro as (
  select distinct on (entity, row_id)
    entity,
    row_id,
    status,
    last_error,
    enqueued_at
  from pcm.auvo_sync_outbox
  order by entity, row_id, enqueued_at desc, id desc
), erros_outbox as (
select
  entity,
  row_id,
  case
    when last_error is null or btrim(last_error) = '' then 'Falha de sincronização sem detalhe.'
    when last_error ~* '(authorization|bearer|api[_ -]?key|token|secret|senha|password)' then
      'Detalhe técnico protegido. Consulte os logs de sincronização.'
    when last_error ~ E'[\\r\\n]' or last_error ~* '(^|[[:space:]])at[[:space:]].*\(' then
      'Falha técnica de sincronização. Consulte os logs de sincronização.'
    else left(regexp_replace(last_error, '[[:space:]]+', ' ', 'g'), 500)
  end as last_error,
  enqueued_at as last_error_at
from ultimo_evento_por_registro
where status = 'error'
), erros_pull as (
  select
    entity,
    null::uuid as row_id,
    case
      when last_error ~* '(authorization|bearer|api[_ -]?key|token|secret|senha|password)' then
        'Detalhe técnico protegido. Consulte os logs de sincronização.'
      when last_error ~ E'[\\r\\n]' or last_error ~* '(^|[[:space:]])at[[:space:]].*\(' then
        'Falha técnica de sincronização. Consulte os logs de sincronização.'
      else left(regexp_replace(last_error, '[[:space:]]+', ' ', 'g'), 500)
    end as last_error,
    last_error_at
  from pcm.auvo_entity_status
  where last_error is not null and btrim(last_error) <> ''
)
select * from (
  select * from erros_outbox
  union all
  select * from erros_pull
) as erros
where (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

comment on view pcm.auvo_sync_error_details is
  'Último erro Auvo por entidade e registro, com detalhe seguro para a UI (E01-S123). Regex de detecção de stack-trace corrigido em 0172.';

grant select on pcm.auvo_sync_error_details to authenticated;

-- Reversão: reaplicar 0166 (view com o bug) — não recomendado, só documentação do caminho.
