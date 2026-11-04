-- E01-S170: múltiplos módulos elegíveis por ação, sem concessão implícita (ADR-0030).
-- Reverso: restaurar a função 0239 e desativar consumidores antes de remover a relação;
-- isso volta a impedir usuários Financeiro autorizados de consultar custos.
create table if not exists config.sso_acao_modulos (
  acao text not null references config.sso_acoes(codigo),
  modulo text not null,
  nivel text not null check (nivel in ('leitura', 'escrita')),
  primary key (acao, modulo)
);
alter table config.sso_acao_modulos enable row level security;
alter table config.sso_acao_modulos force row level security;
insert into config.sso_acao_modulos (acao, modulo, nivel)
  select codigo, modulo, nivel from config.sso_acoes on conflict (acao, modulo) do nothing;
insert into config.sso_acao_modulos (acao, modulo, nivel)
  values ('custo.ler', 'financeiro', 'leitura') on conflict (acao, modulo) do nothing;

create or replace function config.sso_autorizar_acao(p_acao text, p_cliente_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(exists (
    select 1 from config.usuarios u
    join config.sso_acoes a on a.codigo = p_acao
    join pcm.clientes c on c.id = p_cliente_id and c.ativo and c.deleted_at is null
    where u.user_id = auth.uid() and u.ativo and u.papel = auth.jwt() ->> 'user_role'
      and u.papel <> 'cliente-sindico'
      and (u.papel = 'superadmin' or exists (
        select 1 from config.sso_acao_modulos am
        join config.resolver_permissoes_modulo(u.user_id) m on m.modulo = am.modulo
        where am.acao = a.codigo and (m.nivel = 'escrita' or am.nivel = 'leitura')
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
