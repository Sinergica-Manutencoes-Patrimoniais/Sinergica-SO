-- 0199_E03-S10_drop_leads.sql — Sinérgica SO
-- Story E03-S10. Remove a última violação de R1 no schema `comercial`: uma tabela cujo único
-- escritor era o Atendimento (E02-S09), sem tela nenhuma que a consumisse. Pré-condições
-- verificadas em produção antes desta migration: `comercial.leads` com 0 linhas (nunca recebeu
-- UAT de WhatsApp real); `relacionamento.vinculos` com 0 linhas `entidade_tipo='comercial_lead'`
-- — nada para migrar antes do drop (AC-2/AC-5 são no-op nesta produção específica, não porque a
-- lógica de migração de dado foi pulada).
--
-- Decisão registrada em specs/E03-S10-aposentar-comercial-leads/spec.md: `conversas.lead_id` é
-- REMOVIDA, não reapontada pra `comercial.oportunidades` — o equivalente já existe do lado certo
-- (`oportunidades.conversa_id`, S09); reapontar a FK aqui recriaria a violação de R3 que a S09
-- evitou (enriquecimento do Comercial como coluna na tabela do Atendimento).
--
-- Reverso (nesta ordem):
--   create table comercial.leads (
--     id           uuid        primary key default gen_random_uuid(),
--     nome         text        not null,
--     email        text,
--     telefone     text,
--     origem       text,
--     status       text        not null default 'novo',
--     created_at   timestamptz not null default now(),
--     created_by   uuid        not null references auth.users (id),
--     updated_at   timestamptz,
--     updated_by   uuid        references auth.users (id),
--     deleted_at   timestamptz,
--     score        integer     check (score >= 0 and score <= 100),
--     resumo       text,
--     conversa_id  uuid        references atendimento.conversas (id),
--     origem_ref   text,
--     contato_id   uuid        references relacionamento.contatos (id),
--     lead_tier    text,
--     cluster_nome text
--   );
--   alter table comercial.leads enable row level security;
--   alter table comercial.leads force row level security;
--   grant select, insert, update on comercial.leads to authenticated, service_role;
--   create policy "leads_select" on comercial.leads for select to authenticated using (
--     (auth.jwt() ->> 'user_role') = 'superadmin'
--     or (auth.jwt() -> 'user_modulos' ->> 'comercial') in ('leitura', 'escrita')
--   );
--   create policy "leads_insert" on comercial.leads for insert to authenticated with check (
--     (auth.jwt() ->> 'user_role') = 'superadmin'
--     or (auth.jwt() -> 'user_modulos' ->> 'comercial') = 'escrita'
--   );
--   create policy "leads_update" on comercial.leads for update to authenticated
--     using (
--       (auth.jwt() ->> 'user_role') = 'superadmin'
--       or (auth.jwt() -> 'user_modulos' ->> 'comercial') = 'escrita'
--     )
--     with check (
--       (auth.jwt() ->> 'user_role') = 'superadmin'
--       or (auth.jwt() -> 'user_modulos' ->> 'comercial') = 'escrita'
--     );
--   alter table atendimento.conversas add column lead_id uuid references comercial.leads (id);
--   alter table relacionamento.vinculos drop constraint vinculos_entidade_tipo_check;
--   alter table relacionamento.vinculos add constraint vinculos_entidade_tipo_check
--     check (entidade_tipo = any (array['pcm_cliente', 'comercial_lead']));
--   (a função get_timeline_contato precisaria voltar pra ler de comercial.leads também — ver a
--   versão anterior na migration 0068, ramo 'lead')

-- ─────────────────────────── AC-7: get_timeline_contato não referencia mais comercial.leads ──────
-- Mesma função de 0068 (E02-S08), só o ramo 'lead' trocado: lê de comercial.oportunidades
-- (origem='whatsapp') em vez de comercial.leads, que está sendo dropada logo abaixo. Sem chamador
-- na aplicação hoje (busca textual confirma) — mas a função precisa continuar válida, referenciar
-- tabela dropada quebraria qualquer chamada futura.
create or replace function relacionamento.get_timeline_contato(
  p_contato_id uuid,
  p_limit int default 50
) returns table (
  evento_tipo text,
  entidade_tipo text,
  entidade_id uuid,
  titulo text,
  descricao text,
  ocorreu_em timestamptz,
  payload jsonb
)
language sql
stable
security definer
set search_path = relacionamento, atendimento, comercial, public
as $$
  with allowed as (
    select
      auth.role() = 'service_role'
      or current_setting('role', true) = 'service_role'
      or auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
      or auth.jwt() -> 'user_modulos' ->> 'comercial' in ('leitura', 'escrita')
      or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita') as ok
  )
  select *
  from (
    select
      'conversa'::text as evento_tipo,
      'atendimento.conversas'::text as entidade_tipo,
      c.id as entidade_id,
      coalesce(c.contato_nome, 'Conversa')::text as titulo,
      c.ultima_mensagem_preview::text as descricao,
      coalesce(c.ultima_mensagem_em, c.created_at) as ocorreu_em,
      jsonb_build_object(
        'canal', c.canal,
        'status', c.status,
        'client_id', c.client_id
      ) as payload
    from atendimento.conversas c
    where c.contato_id = p_contato_id

    union all

    select
      'mensagem'::text,
      'atendimento.mensagens'::text,
      m.id,
      case m.direcao when 'entrada' then 'Mensagem recebida' else 'Mensagem enviada' end,
      left(coalesce(m.conteudo, ''), 240),
      m.created_at,
      jsonb_build_object(
        'direcao', m.direcao,
        'remetente_tipo', m.remetente_tipo,
        'status_entrega', m.status_entrega
      )
    from atendimento.mensagens m
    join atendimento.conversas c on c.id = m.conversa_id
    where c.contato_id = p_contato_id

    union all

    select
      'lead'::text,
      'comercial.oportunidades'::text,
      o.id,
      coalesce(o.titulo, 'Oportunidade')::text,
      coalesce(o.resumo, o.origem, o.titulo)::text,
      o.created_at,
      jsonb_build_object(
        'score', o.score,
        'origem', o.origem,
        'conversa_id', o.conversa_id
      )
    from comercial.oportunidades o
    where o.contato_id = p_contato_id and o.origem = 'whatsapp' and o.deleted_at is null
  ) eventos
  where exists (select 1 from allowed where ok)
  order by ocorreu_em desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function relacionamento.get_timeline_contato(uuid, int) from public;
grant execute on function relacionamento.get_timeline_contato(uuid, int) to authenticated, service_role;

comment on function relacionamento.get_timeline_contato(uuid, int) is
  'E03-S10: ramo "lead" lê de comercial.oportunidades (origem=whatsapp) desde que comercial.leads '
  'foi dropada. Mesma guarda de permissão de antes (0068).';

-- ─────────────────────────── AC-4: conversas.lead_id removida (decisão no spec.md) ───────────────
-- Deliberado e documentado (DDL de recriação no comentário de topo) — decisão registrada em
-- specs/E03-S10-aposentar-comercial-leads/spec.md, coluna sem chamador (busca textual confirma).
-- squawk-ignore ban-drop-column
alter table atendimento.conversas drop column if exists lead_id;

-- ─────────────────────────── AC-5: check de vinculos sem 'comercial_lead' ────────────────────────
-- NOT VALID aqui; VALIDATE CONSTRAINT em transação separada (0200), mesmo padrão de 0091/0092.
alter table relacionamento.vinculos drop constraint if exists vinculos_entidade_tipo_check;
alter table relacionamento.vinculos add constraint vinculos_entidade_tipo_check
  check (entidade_tipo = any (array['pcm_cliente'])) not valid;

-- ─────────────────────────── AC-6: o drop em si ───────────────────────────────────────────────────
-- Deliberado e documentado (DDL de recriação completo no comentário de topo desta migration,
-- padrão do repositório) — pré-condições verificadas em produção antes (0 linhas, ver comentário).
-- squawk-ignore ban-drop-table
drop table comercial.leads;
