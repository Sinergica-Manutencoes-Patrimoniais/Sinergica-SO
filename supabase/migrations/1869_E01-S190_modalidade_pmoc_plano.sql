-- E01-S190 task 7 — PMOC vira MODALIDADE do Plano de Manutenção, com visão filtrada
-- (Pacote Consolidado 13/11/2026 + resposta 26 do Fabrício, 17/11: "PMOC será uma modalidade do
-- Plano de Manutenção com requisitos legais e documentais próprios… pode ter visão filtrada, mas
-- não módulo nem cadastro independentes"). ADR-1697.
--
-- O ACHADO QUE RECORTA O ESCOPO, E PRECISA SER LIDO ANTES DE AMPLIAR ESTA MIGRATION:
-- `pcm.pmoc_contracts`/`pmoc_properties`/`pmoc_schedules` (`0023_E01-S03`) NÃO são Planos. Não há
-- uma única FK entre eles e `pcm.planos_manutencao` (`0260_E01-S165`); o PMOC é ancorado em
-- `pmoc_properties.client_id` e o Plano em `planos_manutencao.cliente_id`, e só. Transformar
-- Contrato PMOC em Plano seria CRIAR registro (uma Rotina por equipamento de AR × tipo de visita),
-- não classificar — o oposto do que o AC-2 da spec exige ("mantendo rotinas, ocorrências geradas
-- e documentos emitidos") e um caminho direto para a fusão de entidades que a resposta 27 proíbe.
-- A pergunta de produto que falta está escrita na ADR-1697, seção 3. Até ela ser respondida, o
-- módulo PMOC continua no menu: tirá-lo deixaria imóveis, ARTs, laudos e análises microbiológicas
-- de produção sem porta de entrada (perda de alcance, AC-7).
--
-- O QUE ESTA MIGRATION FAZ, ENTÃO: dá ao Plano a capacidade de dizer que é PMOC, a visão filtrada
-- que a decisão pede, e classifica apenas os Planos que o PRÓPRIO PCM já declarou como de origem
-- PMOC — por `pcm.rotina_origem_geracao.origem = 'pmoc'` (`0337_E01-S166`) ou por
-- `pcm.sso_vinculos_ciclo_pmoc` (`1631_E01-S166`). Nada é adivinhado por nome ou por cliente.
--
-- Reverso (exato: devolve o valor anterior lido da própria auditoria):
--   update pcm.planos_manutencao p set modalidade = e.payload ->> 'modalidade_anterior'
--     from audit.events e
--    where e.action = 'plano.classificado_modalidade_pmoc'
--      and e.payload ->> 'migration' = '1869'
--      and e.entity = 'planos_manutencao' and e.entity_id = p.id;
--   drop view if exists pcm.planos_pmoc;
--   alter table pcm.planos_manutencao drop constraint if exists planos_manutencao_modalidade_check;
--   alter table pcm.planos_manutencao drop column if exists modalidade;
--   -- `audit.events` é append-only: os eventos da classificação permanecem, por desenho.

-- ── 1. A modalidade ───────────────────────────────────────────────────────────────────────────
-- Default constante + NOT NULL não reescreve a tabela (PG11+). O CHECK entra `not valid` e é
-- validado em seguida: `validate` só pega ACCESS SHARE, enquanto `add constraint` sem `not valid`
-- varre a tabela sob lock — `1861` e `1864` seguem o mesmo par neste repo.
alter table pcm.planos_manutencao
  add column if not exists modalidade text not null default 'padrao';

-- Bloco `do`: o `.squawk.toml` registra o achado real da `1842` — a GitHub Integration do
-- Supabase NÃO envolve a migration numa transação, então um par `drop constraint` + `add
-- constraint` deixaria a tabela sem invariante entre dois statements. Um `do $$` é um statement
-- só, atômico nos dois runners; aqui ele também dá a idempotência que `add constraint` não tem.
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
     where conrelid = 'pcm.planos_manutencao'::regclass
       and conname = 'planos_manutencao_modalidade_check'
  ) then
    execute 'alter table pcm.planos_manutencao add constraint planos_manutencao_modalidade_check'
         || ' check (modalidade in (''padrao'', ''pmoc'')) not valid';
  end if;
end $$;

alter table pcm.planos_manutencao
  validate constraint planos_manutencao_modalidade_check;

create index if not exists idx_planos_manutencao_modalidade
  on pcm.planos_manutencao (modalidade, cliente_id, id);

-- ── 2. Classificação aditiva dos Planos já declarados como PMOC ───────────────────────────────
-- Só sobe para 'pmoc' o que já tinha declaração explícita de origem. Quem foi declarado continua
-- declarado; a coluna passa a dizer no cabeçalho do Plano o que antes só era legível descendo
-- até a Rotina.
with declarados as (
  select distinct r.plano_id
    from pcm.rotinas_manutencao r
    join pcm.rotina_origem_geracao g
      on g.rotina_logica_id = r.rotina_logica_id
     and g.alvo_tipo = r.alvo_tipo
     and g.alvo_id = coalesce(r.sistema_id, r.equipamento_id, r.grupo_id)
   where g.origem = 'pmoc'
  union
  select distinct v.plano_id from pcm.sso_vinculos_ciclo_pmoc v
), classificados as (
  update pcm.planos_manutencao p
     set modalidade = 'pmoc', updated_at = now()
   where p.id in (select plano_id from declarados)
     and p.modalidade <> 'pmoc'
  returning p.id, p.cliente_id, p.nome, p.estado, p.revisao
)
insert into audit.events (actor_id, action, entity, entity_id, payload)
select
  null,
  'plano.classificado_modalidade_pmoc',
  'planos_manutencao',
  c.id,
  jsonb_build_object(
    'story', 'E01-S190',
    'migration', '1869',
    'modalidade_anterior', 'padrao',
    'modalidade', 'pmoc',
    'cliente_id', c.cliente_id,
    'nome', c.nome,
    'estado', c.estado,
    'revisao', c.revisao,
    -- O Plano não foi recriado nem teve revisão incrementada: rotinas, versões aprovadas e
    -- ocorrências já geradas continuam exatamente como estavam (AC-2).
    'identidade_preservada', true,
    'revisao_incrementada', false
  )
from classificados c;

-- ── 3. A visão filtrada ───────────────────────────────────────────────────────────────────────
-- `security_invoker = true` é obrigatório aqui: a RLS de `pcm.planos_manutencao` é
-- `config.sso_autorizar_acao('plano.gerir', cliente_id)`, por cliente. Uma view `security
-- definer` leria com os direitos do dono (postgres) e devolveria o Plano de qualquer cliente a
-- qualquer autenticado — a visão filtrada viraria vazamento entre condomínios.
create or replace view pcm.planos_pmoc with (security_invoker = true) as
  select p.id, p.cliente_id, p.nome, p.estado, p.revisao, p.modalidade,
         p.created_at, p.created_by, p.updated_at, p.updated_by
    from pcm.planos_manutencao p
   where p.modalidade = 'pmoc';

revoke all on pcm.planos_pmoc from public, anon;
grant select on pcm.planos_pmoc to authenticated;
grant select on pcm.planos_pmoc to service_role;

comment on view pcm.planos_pmoc is
  'E01-S190/ADR-1697 — visão filtrada da modalidade PMOC do Plano de Manutenção. security_invoker: '
  'a RLS por cliente de pcm.planos_manutencao continua sendo quem decide a leitura.';
