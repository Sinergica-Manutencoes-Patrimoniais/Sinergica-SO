-- 0091_E01-S73_inspecoes_abnt.sql — Sinérgica SO
-- Teste de produção do Lucas (2026-07-14): "inspeções cria, mas não pode editar... ajuste a tela
-- de cadastro de inspeção para seguir um modelo profissional de engenharia... referência ABNT NBR
-- 16747 – Inspeção Predial". Decisões do PO (2026-07-14, product.md desta story): reconstruir por
-- EXTENSÃO (não drop — preserva dados), adotar Supabase Storage agora, admin de templates já.
--
-- Estratégia D-1 (design.md): estender `pcm.inspecoes`/`pcm.inspecao_itens` com colunas aditivas
-- (nulas no histórico, nunca dropa dado existente) + 3 tabelas novas de parametrização.
--
-- Nota de correção ao design.md: **não é o primeiro uso de Storage no repo** — a migration
-- `0063_E02-S21_atendimento_inbox_rico.sql` já criou o bucket `atendimento-midias` com o mesmo
-- padrão (privado, RLS por módulo). Segue o padrão já estabelecido, sem ADR novo (não houve ADR
-- pro precedente também).
--
-- Reverso:
--   delete from storage.objects where bucket_id = 'inspecoes-midia';
--   delete from storage.buckets where id = 'inspecoes-midia';
--   drop policy if exists "inspecoes_midia_select" on storage.objects;
--   drop policy if exists "inspecoes_midia_insert" on storage.objects;
--   drop policy if exists "inspecoes_midia_delete" on storage.objects;
--   drop table if exists pcm.checklist_template_itens;
--   drop table if exists pcm.checklist_templates;
--   drop table if exists pcm.tipos_inspecao;
--   drop policy if exists "inspecao_itens_delete" on pcm.inspecao_itens;
--   alter table pcm.inspecoes drop column if exists codigo, drop column if exists tipo_inspecao_id,
--     drop column if exists edificacao, drop column if exists endereco, drop column if exists hora_inicio,
--     drop column if exists hora_fim, drop column if exists inspetor, drop column if exists responsavel_no_local,
--     drop column if exists escopo, drop column if exists norma_tecnica, drop column if exists art,
--     drop column if exists condicoes, drop column if exists anexos;
--   alter table pcm.inspecao_itens drop column if exists categoria, drop column if exists elemento,
--     drop column if exists identificacao, drop column if exists grau_risco, drop column if exists estado_conservacao,
--     drop column if exists anomalia, drop column if exists medicoes, drop column if exists midias,
--     drop column if exists responsavel_acao, drop column if exists observacoes;
--   drop sequence if exists pcm.inspecao_codigo_seq;

-- ── Parametrização (novo) ──────────────────────────────────────────────────────────────────────

create table if not exists pcm.tipos_inspecao (
  id             uuid        primary key default gen_random_uuid(),
  nome           text        not null,
  norma_tecnica  text,
  descricao      text,
  ativo          boolean     not null default true,
  created_at     timestamptz not null default now(),
  created_by     uuid        references auth.users,
  updated_at     timestamptz not null default now(),
  updated_by     uuid        references auth.users,
  deleted_at     timestamptz
);

create table if not exists pcm.checklist_templates (
  id                uuid        primary key default gen_random_uuid(),
  tipo_inspecao_id  uuid        not null references pcm.tipos_inspecao on delete cascade,
  nome              text        not null,
  ativo             boolean     not null default true,
  created_at        timestamptz not null default now(),
  created_by        uuid        references auth.users,
  updated_at        timestamptz not null default now(),
  updated_by        uuid        references auth.users
);

-- Campos guia do item esperado (sem CHECK de sistema — mais livre que `inspecao_itens.sistema`,
-- ver design.md; ao aplicar o template numa inspeção real, o adapter normaliza pro enum válido).
create table if not exists pcm.checklist_template_itens (
  id           uuid        primary key default gen_random_uuid(),
  template_id  uuid        not null references pcm.checklist_templates on delete cascade,
  categoria    text,
  sistema      text,
  elemento     text,
  ordem        int         not null default 0,
  obrigatorio  boolean     not null default false,
  created_at   timestamptz not null default now(),
  created_by   uuid        references auth.users
);

create index if not exists idx_checklist_templates_tipo on pcm.checklist_templates (tipo_inspecao_id);
create index if not exists idx_checklist_template_itens_template
  on pcm.checklist_template_itens (template_id, ordem);

alter table pcm.tipos_inspecao enable row level security;
alter table pcm.tipos_inspecao force row level security;
alter table pcm.checklist_templates enable row level security;
alter table pcm.checklist_templates force row level security;
alter table pcm.checklist_template_itens enable row level security;
alter table pcm.checklist_template_itens force row level security;

grant select, insert, update, delete on
  pcm.tipos_inspecao, pcm.checklist_templates, pcm.checklist_template_itens
to authenticated;
grant select, insert, update, delete on
  pcm.tipos_inspecao, pcm.checklist_templates, pcm.checklist_template_itens
to service_role;

-- Leitura: qualquer um com acesso ao PCM (inspetor precisa ver o checklist do tipo escolhido).
create policy "tipos_inspecao_select" on pcm.tipos_inspecao
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );
create policy "checklist_templates_select" on pcm.checklist_templates
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );
create policy "checklist_template_itens_select" on pcm.checklist_template_itens
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

-- Escrita (D-4, design.md): admin de templates é configuração, não operação diária — exige papel
-- supervisor/superadmin, além de pcm:escrita (supervisor); superadmin sempre passa, mesmo padrão
-- de bypass usado no resto do repo.
create policy "tipos_inspecao_insert" on pcm.tipos_inspecao
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or (auth.jwt() ->> 'user_role' = 'supervisor' and auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita')
  );
create policy "tipos_inspecao_update" on pcm.tipos_inspecao
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or (auth.jwt() ->> 'user_role' = 'supervisor' and auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita')
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or (auth.jwt() ->> 'user_role' = 'supervisor' and auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita')
  );
create policy "tipos_inspecao_delete" on pcm.tipos_inspecao
  for delete to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or (auth.jwt() ->> 'user_role' = 'supervisor' and auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita')
  );

create policy "checklist_templates_insert" on pcm.checklist_templates
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or (auth.jwt() ->> 'user_role' = 'supervisor' and auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita')
  );
create policy "checklist_templates_update" on pcm.checklist_templates
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or (auth.jwt() ->> 'user_role' = 'supervisor' and auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita')
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or (auth.jwt() ->> 'user_role' = 'supervisor' and auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita')
  );
create policy "checklist_templates_delete" on pcm.checklist_templates
  for delete to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or (auth.jwt() ->> 'user_role' = 'supervisor' and auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita')
  );

create policy "checklist_template_itens_insert" on pcm.checklist_template_itens
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or (auth.jwt() ->> 'user_role' = 'supervisor' and auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita')
  );
create policy "checklist_template_itens_update" on pcm.checklist_template_itens
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or (auth.jwt() ->> 'user_role' = 'supervisor' and auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita')
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or (auth.jwt() ->> 'user_role' = 'supervisor' and auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita')
  );
create policy "checklist_template_itens_delete" on pcm.checklist_template_itens
  for delete to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or (auth.jwt() ->> 'user_role' = 'supervisor' and auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita')
  );

-- ── Cabeçalho — pcm.inspecoes (colunas aditivas, AC-2) ─────────────────────────────────────────

create sequence if not exists pcm.inspecao_codigo_seq;

-- Squawk: DEFAULT volátil (nextval) numa tabela com dado de produção pede rewrite/lock — trigger
-- BEFORE INSERT evita isso (mesmo resultado: código gerado sozinho em toda linha nova).
alter table pcm.inspecoes add column if not exists codigo text;

create or replace function pcm.fn_gerar_codigo_inspecao()
returns trigger
language plpgsql
set search_path = pcm, public
as $$
begin
  if new.codigo is null then
    new.codigo := 'INSP-' || lpad(nextval('pcm.inspecao_codigo_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_gerar_codigo_inspecao on pcm.inspecoes;
create trigger trg_gerar_codigo_inspecao
before insert on pcm.inspecoes
for each row execute function pcm.fn_gerar_codigo_inspecao();

-- Squawk: FK direto na ALTER ADD COLUMN faz scan+lock nas 2 tabelas — NOT VALID aqui, VALIDATE na
-- migration seguinte (transação separada — mesmo padrão de 0070/0071, 0073/0074, 0082/0083).
alter table pcm.inspecoes add column if not exists tipo_inspecao_id uuid;
alter table pcm.inspecoes add constraint inspecoes_tipo_inspecao_id_fkey
  foreign key (tipo_inspecao_id) references pcm.tipos_inspecao (id) not valid;
alter table pcm.inspecoes add column if not exists edificacao text;
alter table pcm.inspecoes add column if not exists endereco text;
alter table pcm.inspecoes add column if not exists hora_inicio time;
alter table pcm.inspecoes add column if not exists hora_fim time;
alter table pcm.inspecoes add column if not exists inspetor text;
alter table pcm.inspecoes add column if not exists responsavel_no_local text;
alter table pcm.inspecoes add column if not exists escopo text;
alter table pcm.inspecoes add column if not exists norma_tecnica text;
alter table pcm.inspecoes add column if not exists art text;
alter table pcm.inspecoes add column if not exists condicoes text;
alter table pcm.inspecoes add column if not exists anexos jsonb not null default '[]'::jsonb;

create unique index if not exists uq_inspecoes_codigo on pcm.inspecoes (codigo) where codigo is not null;

-- ── Itens — pcm.inspecao_itens (colunas aditivas, AC-3) ────────────────────────────────────────

alter table pcm.inspecao_itens add column if not exists categoria text;
alter table pcm.inspecao_itens add column if not exists elemento text;
alter table pcm.inspecao_itens add column if not exists identificacao text;
alter table pcm.inspecao_itens add column if not exists grau_risco text
  check (grau_risco in ('baixo', 'medio', 'alto', 'critico'));
alter table pcm.inspecao_itens add column if not exists estado_conservacao text;
alter table pcm.inspecao_itens add column if not exists anomalia text;
alter table pcm.inspecao_itens add column if not exists medicoes jsonb;
-- Refs de Storage: [{tipo:'foto'|'video'|'documento', path, nome}] — mídia do Auvo (se algum dia
-- vier) continua em `foto_url` (URL), nunca sobe pro Storage.
alter table pcm.inspecao_itens add column if not exists midias jsonb not null default '[]'::jsonb;
alter table pcm.inspecao_itens add column if not exists responsavel_acao text;
alter table pcm.inspecao_itens add column if not exists observacoes text;

-- NBR 16747: resultado é Conforme/Não Conforme/Não Aplicável — amplia o CHECK existente.
-- NOT VALID aqui, VALIDATE na migration seguinte (mesmo motivo do FK acima).
alter table pcm.inspecao_itens drop constraint if exists inspecao_itens_resultado_check;
alter table pcm.inspecao_itens add constraint inspecao_itens_resultado_check
  check (resultado in ('conforme', 'nao_conforme', 'atencao', 'nao_avaliado', 'nao_aplicavel')) not valid;

-- AC-1 "excluir item também disponível": a 0019 nunca teve policy nem grant de DELETE pra
-- `inspecao_itens` (achado ao implementar esta story) — sem isso, RLS FORCE bloqueava qualquer
-- tentativa de excluir item, mesmo com pcm:escrita.
grant delete on pcm.inspecao_itens to authenticated;
create policy "inspecao_itens_delete" on pcm.inspecao_itens
  for delete to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
  );

-- ── Storage — bucket inspecoes-midia (AC-5) ────────────────────────────────────────────────────
-- Segue o padrão já estabelecido em 0063 (atendimento-midias): privado, RLS por módulo.

insert into storage.buckets (id, name, public, file_size_limit)
values ('inspecoes-midia', 'inspecoes-midia', false, 104857600) -- 100MB (cobre vídeo curto)
on conflict (id) do nothing;

grant usage on schema storage to authenticated;
grant select, insert, delete on storage.objects to authenticated;

create policy "inspecoes_midia_select" on storage.objects for select to authenticated
using (bucket_id = 'inspecoes-midia' and (
  auth.jwt() ->> 'user_role' = 'superadmin'
  or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
));
create policy "inspecoes_midia_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'inspecoes-midia' and (
  auth.jwt() ->> 'user_role' = 'superadmin'
  or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
));
create policy "inspecoes_midia_delete" on storage.objects for delete to authenticated
using (bucket_id = 'inspecoes-midia' and (
  auth.jwt() ->> 'user_role' = 'superadmin'
  or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
));
