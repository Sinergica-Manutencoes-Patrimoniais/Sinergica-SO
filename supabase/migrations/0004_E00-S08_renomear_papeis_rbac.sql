-- 0004_E00-S08_renomear_papeis_rbac.sql — Sinérgica SO
-- Story E00-S08. Renomeia os papéis internos definidos em 0002_E00-S05_perfis_rbac.sql:
--   admin → superadmin · escritorio → supervisor · tecnico → colaborador
-- `cliente-sindico` não muda (ator externo, fora da hierarquia de colaborador interno).
-- Mesma matriz de permissão de E00-S05 — é rename, não nova regra. Ver
-- specs/E00-S08-renomear-papeis-rbac/spec.md (AC-1 a AC-6) e ADR-0003 (mecanismo, inalterado).
--
-- Reverso:
--   alter table config.usuarios drop constraint if exists usuarios_papel_check;
--   update config.usuarios set papel = 'admin' where papel = 'superadmin';
--   update config.usuarios set papel = 'escritorio' where papel = 'supervisor';
--   update config.usuarios set papel = 'tecnico' where papel = 'colaborador';
--   alter table config.usuarios add constraint usuarios_papel_check
--     check (papel in ('admin', 'escritorio', 'tecnico', 'cliente-sindico'));
--   -- + reverter cada `alter policy` abaixo trocando os literais de volta.
--
-- Ordem importa: 1) remove a constraint antiga (senão o remap de dados abaixo violaria ela),
-- 2) remapeia as linhas existentes, 3) adiciona a constraint nova.

-- ─────────────────────── CONSTRAINT + REMAP DE DADOS ───────────────────────

alter table config.usuarios drop constraint usuarios_papel_check;

update config.usuarios set papel = 'superadmin' where papel = 'admin';
update config.usuarios set papel = 'supervisor' where papel = 'escritorio';
update config.usuarios set papel = 'colaborador' where papel = 'tecnico';

-- NOT VALID aqui, VALIDATE CONSTRAINT na migration seguinte (0005) — Squawk
-- `constraint-missing-not-valid`: as duas na mesma transação bloqueiam leitura durante o
-- table-scan de validação. NOT VALID já exige a regra em linhas novas/alteradas a partir de
-- agora (as policies abaixo já podem usar os novos papéis com segurança); a validação das linhas
-- existentes (já remapeadas acima) fica pra depois, com lock mais leve.
alter table config.usuarios add constraint usuarios_papel_check
  check (papel in ('superadmin', 'supervisor', 'colaborador', 'cliente-sindico')) not valid;

-- ─────────────────────── RLS — config.usuarios ──────────────────────────────

alter policy "usuarios_select" on config.usuarios
  using (user_id = auth.uid() or auth.jwt() ->> 'user_role' = 'superadmin');

alter policy "usuarios_update" on config.usuarios
  using (auth.jwt() ->> 'user_role' = 'superadmin')
  with check (auth.jwt() ->> 'user_role' = 'superadmin');

-- ─────────────────────── RLS — pcm.clientes ─────────────────────────────────

alter policy "clientes_select" on pcm.clientes
  using (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor', 'colaborador'));

alter policy "clientes_insert" on pcm.clientes
  with check (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

alter policy "clientes_update" on pcm.clientes
  using (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'))
  with check (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

-- ─────────────────────── RLS — pcm.ordens_servico ───────────────────────────

alter policy "ordens_servico_select" on pcm.ordens_servico
  using (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor', 'colaborador'));

alter policy "ordens_servico_insert" on pcm.ordens_servico
  with check (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

alter policy "ordens_servico_update" on pcm.ordens_servico
  using (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'))
  with check (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

-- ─────────────────────── RLS — atendimento.config_ze ────────────────────────

alter policy "config_ze_select" on atendimento.config_ze
  using (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

alter policy "config_ze_insert" on atendimento.config_ze
  with check (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

alter policy "config_ze_update" on atendimento.config_ze
  using (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'))
  with check (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

-- ─────────────────────── RLS — atendimento.wa_messages ──────────────────────

alter policy "wa_messages_select" on atendimento.wa_messages
  using (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

alter policy "wa_messages_insert" on atendimento.wa_messages
  with check (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

alter policy "wa_messages_update" on atendimento.wa_messages
  using (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'))
  with check (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

-- ─────────────────────── RLS — atendimento.wa_queue ─────────────────────────

alter policy "wa_queue_select" on atendimento.wa_queue
  using (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

alter policy "wa_queue_insert" on atendimento.wa_queue
  with check (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

alter policy "wa_queue_update" on atendimento.wa_queue
  using (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'))
  with check (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

-- ─────────────────────── RLS — comercial.leads ──────────────────────────────

alter policy "leads_select" on comercial.leads
  using (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

alter policy "leads_insert" on comercial.leads
  with check (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

alter policy "leads_update" on comercial.leads
  using (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'))
  with check (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

-- ─────────────────────── RLS — config.feature_flags ─────────────────────────

alter policy "feature_flags_select" on config.feature_flags
  using (auth.jwt() ->> 'user_role' in ('superadmin', 'supervisor'));

alter policy "feature_flags_insert" on config.feature_flags
  with check (auth.jwt() ->> 'user_role' = 'superadmin');

alter policy "feature_flags_update" on config.feature_flags
  using (auth.jwt() ->> 'user_role' = 'superadmin')
  with check (auth.jwt() ->> 'user_role' = 'superadmin');

-- ── Verificação (rode após aplicar) ────────────────────────────────────────
-- select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'config.usuarios'::regclass and contype = 'c';
-- select tablename, policyname, qual, with_check from pg_policies where schemaname in ('pcm','atendimento','comercial','config') order by tablename, policyname;
-- select papel, count(*) from config.usuarios group by papel;
