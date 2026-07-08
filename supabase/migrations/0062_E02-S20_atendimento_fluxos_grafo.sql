-- 0062_E02-S20_atendimento_fluxos_grafo.sql — recipes e logs do editor node-graph.
-- A definição continua no JSONB de fluxos: nós antigos sem proximoIds são interpretados em ordem.
-- Reverso: drop table atendimento.fluxo_logs; drop table atendimento.fluxo_recipes;

create table atendimento.fluxo_recipes (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao text not null default '',
  definicao jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table atendimento.fluxo_logs (
  id uuid primary key default gen_random_uuid(),
  fluxo_id uuid not null references atendimento.fluxos(id),
  conversa_id uuid not null references atendimento.conversas(id),
  nos_percorridos jsonb not null default '[]'::jsonb,
  entrada jsonb not null default '{}'::jsonb,
  saida jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_fluxo_logs_fluxo_created on atendimento.fluxo_logs (fluxo_id, created_at desc);
alter table atendimento.fluxo_recipes enable row level security;
alter table atendimento.fluxo_recipes force row level security;
alter table atendimento.fluxo_logs enable row level security;
alter table atendimento.fluxo_logs force row level security;
grant select on atendimento.fluxo_recipes, atendimento.fluxo_logs to authenticated;
grant select, insert, update, delete on atendimento.fluxo_recipes, atendimento.fluxo_logs to service_role;

create policy "fluxo_recipes_select" on atendimento.fluxo_recipes for select to authenticated
using (auth.jwt() ->> 'user_role' = 'superadmin' or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita'));
create policy "fluxo_logs_select" on atendimento.fluxo_logs for select to authenticated
using (auth.jwt() ->> 'user_role' = 'superadmin' or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita'));

insert into atendimento.fluxo_recipes (nome, descricao, definicao) values
('Qualificação comercial', 'Necessidade, orçamento e prazo', '[
 {"id":"necessidade","campo":"necessidade","pergunta":"O que você precisa?","obrigatorio":true,"ordem":0,"x":80,"y":40,"tipo":"pergunta","proximoIds":["orcamento"]},
 {"id":"orcamento","campo":"orcamento","pergunta":"Qual a faixa de orçamento?","obrigatorio":true,"ordem":1,"x":80,"y":220,"tipo":"decisao","condicao":"orçamento informado","proximoIds":["prazo"]},
 {"id":"prazo","campo":"prazo","pergunta":"Para quando precisa?","obrigatorio":true,"ordem":2,"x":80,"y":400,"tipo":"pergunta","proximoIds":[]}
]'::jsonb);
