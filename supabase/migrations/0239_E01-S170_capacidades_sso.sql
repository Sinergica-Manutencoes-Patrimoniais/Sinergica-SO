-- E01-S170: fundação aditiva de capacidades por ação e escopo, ADR-0029.
-- Reverso operacional: desabilitar consumidores antes de retirar estas tabelas e funções;
-- não excluir concessões ou eventos em produção sem preservar histórico e revisão.

create table if not exists config.sso_acoes (
  codigo text primary key,
  modulo text not null,
  nivel text not null default 'escrita' check (nivel in ('leitura', 'escrita')),
  exige_concessao_individual boolean not null default false
);
create table if not exists config.sso_perfis (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(btrim(nome)) > 0),
  ativo boolean not null default true,
  revisao integer not null default 0 check (revisao >= 0)
);
create table if not exists config.sso_usuario_perfis (
  usuario_id uuid not null references config.usuarios(user_id),
  perfil_id uuid not null references config.sso_perfis(id),
  ativo boolean not null default true,
  revisao integer not null default 0 check (revisao >= 0),
  primary key (usuario_id, perfil_id)
);
create table if not exists config.sso_concessoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references config.usuarios(user_id),
  perfil_id uuid references config.sso_perfis(id),
  acao text not null references config.sso_acoes(codigo),
  cliente_id uuid references pcm.clientes(id),
  ativa boolean not null default true,
  revisao integer not null default 0 check (revisao >= 0),
  check ((usuario_id is null) <> (perfil_id is null)),
  unique nulls not distinct (usuario_id, perfil_id, acao, cliente_id)
);
create index if not exists idx_sso_concessoes_usuario on config.sso_concessoes (usuario_id, acao, cliente_id) where ativa;
create index if not exists idx_sso_concessoes_perfil on config.sso_concessoes (perfil_id, acao, cliente_id) where ativa;

alter table config.sso_acoes enable row level security;
alter table config.sso_acoes force row level security;
alter table config.sso_perfis enable row level security;
alter table config.sso_perfis force row level security;
alter table config.sso_usuario_perfis enable row level security;
alter table config.sso_usuario_perfis force row level security;
alter table config.sso_concessoes enable row level security;
alter table config.sso_concessoes force row level security;

insert into config.sso_acoes (codigo, modulo, exige_concessao_individual) values
 ('plano.gerir', 'pcm', true), ('visita.confirmar', 'pcm', false),
 ('execucao.validar', 'pcm', false), ('chamado.encerrar', 'pcm', false),
 ('cadastro.aprovar', 'pcm', false), ('codigo.substituir', 'pcm', false),
 ('material.gerir', 'pcm', false), ('custo.ler', 'comercial', false),
 ('orcamento.emitir', 'comercial', false), ('faturavel.efetivar', 'financeiro', false),
 ('integracao.reconciliar', 'pcm', false)
on conflict (codigo) do nothing;
update config.sso_acoes set nivel = 'leitura' where codigo = 'custo.ler';

create or replace function config.sso_autorizar_acao(p_acao text, p_cliente_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(exists (
    select 1 from config.usuarios u
    join config.sso_acoes a on a.codigo = p_acao
    join pcm.clientes c on c.id = p_cliente_id and c.ativo and c.deleted_at is null
    where u.user_id = auth.uid() and u.ativo and u.papel = auth.jwt() ->> 'user_role'
      and u.papel <> 'cliente-sindico'
      and (u.papel = 'superadmin' or exists (
        select 1 from config.resolver_permissoes_modulo(u.user_id) m
        where m.modulo = a.modulo and (m.nivel = 'escrita' or a.nivel = 'leitura')
      ))
      and exists (
        select 1 from config.sso_concessoes g
        where g.ativa and g.acao = a.codigo and (g.cliente_id is null or g.cliente_id = c.id)
          and (g.usuario_id = u.user_id or (
            not a.exige_concessao_individual and g.perfil_id is not null
            and exists (select 1 from config.sso_usuario_perfis up
              join config.sso_perfis p on p.id = up.perfil_id and p.ativo
              where up.usuario_id = u.user_id and up.perfil_id = g.perfil_id and up.ativo)
          ))
      )
  ), false);
$$;
revoke all on function config.sso_autorizar_acao(text, uuid) from public, anon;
grant execute on function config.sso_autorizar_acao(text, uuid) to authenticated;
