-- ADR-0111: fundação protegida; sem gravação via API e sem encerramento de Chamado.
create table pcm.chamado_escopo_composicoes (
  chamado_id uuid primary key references pcm.chamados(id),
  declarada_completa boolean not null default false,
  revisao bigint not null default 1 check (revisao > 0)
);
create table pcm.chamado_escopo_parcelas (
  id uuid primary key,
  chamado_id uuid not null references pcm.chamados(id),
  descricao text not null check (length(btrim(descricao)) between 1 and 1000),
  situacao text not null default 'pendente' check (situacao in ('pendente', 'atendida')),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);
create index chamado_escopo_parcelas_chamado_idx on pcm.chamado_escopo_parcelas(chamado_id, id);
create table pcm.chamado_continuacoes_propostas (
  id uuid primary key,
  chamado_id uuid not null references pcm.chamados(id),
  os_anterior_id uuid not null references pcm.ordens_servico(id),
  descricao_restante text not null check (length(btrim(descricao_restante)) between 1 and 4000),
  minutos_restantes integer not null check (minutos_restantes > 0),
  situacao text not null default 'pendente' check (situacao in ('pendente', 'rejeitada', 'executada')),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);
create index chamado_continuacoes_chamado_idx on pcm.chamado_continuacoes_propostas(chamado_id, id);
alter table pcm.chamado_escopo_composicoes enable row level security;
alter table pcm.chamado_escopo_composicoes force row level security;
alter table pcm.chamado_escopo_parcelas enable row level security;
alter table pcm.chamado_escopo_parcelas force row level security;
alter table pcm.chamado_continuacoes_propostas enable row level security;
alter table pcm.chamado_continuacoes_propostas force row level security;
revoke all on pcm.chamado_escopo_composicoes, pcm.chamado_escopo_parcelas,
  pcm.chamado_continuacoes_propostas from public, anon, authenticated;

-- Apenas avaliação informativa. Nunca habilitar até concluir composição, segurança e locks.
create function pcm.sso_avaliar_encerramento_chamado(p_cliente_id uuid, p_chamado_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.chamado_os_gate where id), false) then
    raise exception 'avaliacao_bloqueada' using errcode = '55000';
  end if;
  if auth.uid() is null or config.sso_autorizar_acao('chamado.encerrar', p_cliente_id) is distinct from true
    or not exists (select 1 from pcm.chamados c where c.id = p_chamado_id
      and c.cliente_id = p_cliente_id and c.deleted_at is null) then
    raise exception 'chamado_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'composicaoCompleta', coalesce((select c.declarada_completa from pcm.chamado_escopo_composicoes c where c.chamado_id = p_chamado_id), false),
    'parcelas', (select count(*) from pcm.chamado_escopo_parcelas p where p.chamado_id = p_chamado_id),
    'parcelasPendentes', (select count(*) from pcm.chamado_escopo_parcelas p where p.chamado_id = p_chamado_id and p.situacao <> 'atendida'),
    'continuacoesPendentes', (select count(*) from pcm.chamado_continuacoes_propostas p where p.chamado_id = p_chamado_id and p.situacao = 'pendente'),
    'ordens', (select count(*) from pcm.ordens_servico o where o.chamado_id = p_chamado_id and o.deleted_at is null),
    'ordensNaoFinalizadas', (select count(*) from pcm.ordens_servico o where o.chamado_id = p_chamado_id and o.deleted_at is null and o.status is distinct from 'finalizado')
  ) into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_avaliar_encerramento_chamado(uuid, uuid) from public, anon, authenticated, service_role;
