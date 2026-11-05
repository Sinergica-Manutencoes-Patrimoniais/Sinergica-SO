-- ADR-0172: classificação informativa de vínculos legados; sem gravação ou inferência temporal.
create function pcm.sso_prever_referencias_chamado_os(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(chamado_id uuid,os_legada_id uuid,os_relacionadas bigint,classificacao text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.migracao_preflight_gate where id),false) then
    raise exception 'diagnostico_bloqueado' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or not exists(select 1 from config.usuarios u
    where u.user_id=auth.uid() and u.ativo and u.papel='superadmin')
    or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then
    raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select c.id,
    case when o.id is not null and o.client_id=p_cliente_id and o.deleted_at is null then o.id else null end,
    (select count(*) from pcm.ordens_servico relacion where relacion.chamado_id=c.id and relacion.client_id=p_cliente_id and relacion.deleted_at is null),
    case when c.ordem_servico_id is null then 'sem_referencia_singular'
      when o.id is null or o.deleted_at is not null then 'referencia_ausente_ou_excluida'
      when o.client_id is distinct from p_cliente_id then 'cliente_divergente'
      when exists(select 1 from pcm.chamados outro where outro.ordem_servico_id=c.ordem_servico_id and outro.id<>c.id and outro.cliente_id=p_cliente_id and outro.deleted_at is null) then 'referencia_compartilhada_revisar'
      when o.chamado_id is null then 'vinculo_inverso_ausente'
      when o.chamado_id is distinct from c.id then 'vinculo_inverso_divergente'
      else 'referencia_coerente' end::text
    from pcm.chamados c left join pcm.ordens_servico o on o.id=c.ordem_servico_id
    where c.cliente_id=p_cliente_id and c.deleted_at is null and (p_apos is null or c.id>p_apos)
    order by c.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_prever_referencias_chamado_os(uuid,uuid,integer) from public,anon,authenticated,service_role;
