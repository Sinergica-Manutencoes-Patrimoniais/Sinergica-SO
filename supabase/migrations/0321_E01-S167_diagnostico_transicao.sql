-- ADR-0104: preflight somente leitura; não altera dados nem libera cardinalidade 1:N.
create function pcm.sso_diagnosticar_transicao_chamado_os()
returns table (
  os_cliente_divergente bigint,
  os_chamado_ausente_ou_excluido bigint,
  chamado_os_legada_inexistente_ou_excluida bigint,
  chamado_os_legada_cliente_divergente bigint,
  chamado_os_legada_vinculo_divergente bigint,
  chamado_os_legada_sem_vinculo_inverso bigint,
  os_referenciada_por_multiplos_chamados bigint
)
language sql stable security invoker set search_path = '' as $$
  select
    (select count(*) from pcm.ordens_servico o join pcm.chamados c on c.id = o.chamado_id
      where o.deleted_at is null and c.deleted_at is null and o.client_id is distinct from c.cliente_id),
    (select count(*) from pcm.ordens_servico o left join pcm.chamados c on c.id = o.chamado_id
      where o.deleted_at is null and o.chamado_id is not null and (c.id is null or c.deleted_at is not null)),
    (select count(*) from pcm.chamados c left join pcm.ordens_servico o on o.id = c.ordem_servico_id
      where c.deleted_at is null and c.ordem_servico_id is not null and (o.id is null or o.deleted_at is not null)),
    (select count(*) from pcm.chamados c join pcm.ordens_servico o on o.id = c.ordem_servico_id
      where c.deleted_at is null and o.deleted_at is null and o.client_id is distinct from c.cliente_id),
    (select count(*) from pcm.chamados c join pcm.ordens_servico o on o.id = c.ordem_servico_id
      where c.deleted_at is null and o.deleted_at is null and o.chamado_id is not null and o.chamado_id <> c.id),
    (select count(*) from pcm.chamados c join pcm.ordens_servico o on o.id = c.ordem_servico_id
      where c.deleted_at is null and o.deleted_at is null and o.chamado_id is null),
    (select count(*) from (select c.ordem_servico_id from pcm.chamados c
      where c.deleted_at is null and c.ordem_servico_id is not null
      group by c.ordem_servico_id having count(*) > 1) duplicadas);
$$;
revoke all on function pcm.sso_diagnosticar_transicao_chamado_os() from public, anon, authenticated;
grant execute on function pcm.sso_diagnosticar_transicao_chamado_os() to service_role;
