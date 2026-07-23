-- 0127_E01-S82_priorizacao_gutd.sql
-- GUTD (Gravidade·Urgência·Tendência·Dor do cliente) — AC-1: coluna `dor_cliente` em
-- `pcm.ordens_servico` (nullable — retrocompat AC-4, OS antigas ficam sem D). AC-3: pesos
-- configuráveis em `config.priorizacao_gutd` (singleton, soma=100 garantida também no banco —
-- defesa em profundidade além da validação no domínio). O score ponderado NUNCA é gravado
-- (AC-2, sempre recalculado em runtime) — diferente do `score_pcm` (produto G×U×T, GENERATED,
-- mantido como está, não removido — só deixa de ser o critério padrão de ordenação do backlog).
-- Reverso:
--   delete from config.priorizacao_gutd where id = 1;
--   drop table if exists config.priorizacao_gutd;
--   alter table pcm.ordens_servico drop column if exists dor_cliente;

alter table pcm.ordens_servico
  add column if not exists dor_cliente int check (dor_cliente between 1 and 5);

create table config.priorizacao_gutd (
  id int primary key default 1,
  peso_gravidade int not null default 25 check (peso_gravidade between 0 and 100),
  peso_urgencia int not null default 25 check (peso_urgencia between 0 and 100),
  peso_tendencia int not null default 25 check (peso_tendencia between 0 and 100),
  peso_dor_cliente int not null default 25 check (peso_dor_cliente between 0 and 100),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  constraint priorizacao_gutd_singleton check (id = 1),
  constraint priorizacao_gutd_soma_100 check (
    peso_gravidade + peso_urgencia + peso_tendencia + peso_dor_cliente = 100
  )
);

alter table config.priorizacao_gutd enable row level security;
alter table config.priorizacao_gutd force row level security;
-- Select pra QUALQUER authenticated (não só superadmin) — os pesos não são segredo, e todo
-- usuário do PCM precisa deles pra calcular a ordenação do backlog/hub em runtime (AC-2).
grant select on config.priorizacao_gutd to authenticated;
grant insert, update on config.priorizacao_gutd to authenticated;
grant select, insert, update, delete on config.priorizacao_gutd to service_role;

create policy "priorizacao_gutd_select" on config.priorizacao_gutd for select to authenticated
  using (true);
create policy "priorizacao_gutd_escrita_superadmin" on config.priorizacao_gutd for all to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin')
  with check (auth.jwt() ->> 'user_role' = 'superadmin');

insert into config.priorizacao_gutd (id, peso_gravidade, peso_urgencia, peso_tendencia, peso_dor_cliente)
values (1, 25, 25, 25, 25)
on conflict (id) do nothing;
