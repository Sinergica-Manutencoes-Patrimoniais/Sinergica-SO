-- 0058_E02-S17_atendimento_automacao.sql — Sinérgica SO
-- Aba "Coment. IG" (automações de comentário) + "Opt-outs" (E02-S17). Regras aplicadas na
-- automação de comentário/DM do Instagram ficam FORA de escopo (não há integração real do Graph
-- API de comentários neste ambiente) — esta migration entrega a CONFIGURAÇÃO das regras, para
-- quando a integração existir consumi-las (mesmo princípio de E02-S16: não fabricar chamada
-- externa sem credenciais).
--
-- Reverso:
--   drop table if exists atendimento.opt_outs;
--   drop table if exists atendimento.ig_comment_automations;

create table if not exists atendimento.ig_comment_automations (
  id            uuid        primary key default gen_random_uuid(),
  canal_id      uuid        references atendimento.canais_externos(id),
  nome          text        not null,
  palavras_gatilho text[]   not null default '{}',
  resposta_dm   text        not null,
  ativo         boolean     not null default true,
  created_at    timestamptz not null default now(),
  created_by    uuid        references auth.users
);

create index if not exists idx_ig_comment_automations_canal
  on atendimento.ig_comment_automations (canal_id, ativo);

create table if not exists atendimento.opt_outs (
  id            uuid        primary key default gen_random_uuid(),
  contato_id    uuid        references relacionamento.contatos(id),
  canal         text        not null default 'whatsapp' check (canal in ('whatsapp', 'instagram', 'messenger', 'todos')),
  motivo        text,
  created_at    timestamptz not null default now(),
  created_by    uuid        references auth.users
);

create index if not exists idx_opt_outs_contato_canal
  on atendimento.opt_outs (contato_id, canal);

alter table atendimento.ig_comment_automations enable row level security;
alter table atendimento.ig_comment_automations force row level security;
alter table atendimento.opt_outs               enable row level security;
alter table atendimento.opt_outs               force row level security;

grant select, insert, update on atendimento.ig_comment_automations to authenticated;
grant select, insert, update, delete on atendimento.ig_comment_automations to service_role;
grant select, insert, delete on atendimento.opt_outs to authenticated;
grant select, insert, update, delete on atendimento.opt_outs to service_role;

create policy "ig_comment_automations_select" on atendimento.ig_comment_automations
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
  );

create policy "ig_comment_automations_insert" on atendimento.ig_comment_automations
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );

create policy "ig_comment_automations_update" on atendimento.ig_comment_automations
  for update to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  )
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );

create policy "opt_outs_select" on atendimento.opt_outs
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
  );

create policy "opt_outs_insert" on atendimento.opt_outs
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );

create policy "opt_outs_delete" on atendimento.opt_outs
  for delete to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );
