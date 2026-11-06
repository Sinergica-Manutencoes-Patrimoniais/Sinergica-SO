-- ADR-0115: expansão apenas; nenhum caminho de criação ou alteração é liberado.
create table comercial.proposta_origens_operacionais (
  proposta_id uuid primary key references comercial.propostas(id),
  ordem_servico_id uuid not null references pcm.ordens_servico(id),
  lista_materiais_id uuid not null references pcm.listas_materiais(id),
  criado_em timestamptz not null default now(),
  criado_por uuid not null references config.usuarios(user_id)
);
alter table comercial.proposta_origens_operacionais enable row level security;
alter table comercial.proposta_origens_operacionais force row level security;
revoke all on comercial.proposta_origens_operacionais from public, anon, authenticated, service_role;

create function comercial.sso_listar_orcamentos_os(p_cliente_id uuid, p_ordem_servico_id uuid, p_limite integer, p_apos uuid default null)
returns table(id uuid, status text, versao integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_cliente_id is null or p_ordem_servico_id is null or p_limite is null or p_limite not between 1 and 100 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if config.sso_autorizar_acao('material.gerir', p_cliente_id) is not true
    or config.sso_autorizar_acao('custo.ler', p_cliente_id) is not true
    or not exists (select 1 from pcm.ordens_servico o where o.id = p_ordem_servico_id
      and o.client_id = p_cliente_id and o.deleted_at is null) then
    raise exception 'ordem_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  if exists (
    select 1 from comercial.proposta_origens_operacionais v
    left join comercial.propostas p on p.id = v.proposta_id and p.deleted_at is null
    left join comercial.oportunidades op on op.id = p.oportunidade_id
    left join pcm.listas_materiais l on l.id = v.lista_materiais_id
    where v.ordem_servico_id = p_ordem_servico_id and
      (op.cliente_id is distinct from p_cliente_id or l.cliente_id is distinct from p_cliente_id
       or l.ordem_servico_id is distinct from p_ordem_servico_id)
  ) then raise exception 'origem_inconsistente' using errcode = '23514'; end if;
  return query select p.id, p.status, p.versao_atual
    from comercial.proposta_origens_operacionais v
    join comercial.propostas p on p.id = v.proposta_id
    where v.ordem_servico_id = p_ordem_servico_id and (p_apos is null or p.id > p_apos)
    order by p.id limit p_limite;
end;
$$;
revoke all on function comercial.sso_listar_orcamentos_os(uuid, uuid, integer, uuid) from public, anon, service_role;
grant execute on function comercial.sso_listar_orcamentos_os(uuid, uuid, integer, uuid) to authenticated;
