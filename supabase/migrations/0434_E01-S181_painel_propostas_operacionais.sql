-- ADR-0208: projeção mínima interna, sem custo; acesso revogado e gate false.
insert into config.sso_acoes(codigo, modulo, nivel, exige_concessao_individual)
  values ('orcamento.operacional.ler', 'comercial', 'leitura', false) on conflict (codigo) do nothing;
create table comercial.sso_painel_operacional_gate (id boolean primary key default true check (id), habilitado boolean not null default false);
alter table comercial.sso_painel_operacional_gate enable row level security;
alter table comercial.sso_painel_operacional_gate force row level security;
revoke all on comercial.sso_painel_operacional_gate from public, anon, authenticated, service_role;
insert into comercial.sso_painel_operacional_gate(id, habilitado) values (true, false);

create function comercial.sso_painel_propostas_operacionais(p_inicio date, p_fim date, p_apos uuid default null)
returns table(id uuid, cliente_id uuid, cliente_nome text, os_id uuid, os_numero text,
  status text, versao integer, criada_em timestamptz, tem_oportunidade boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_inicio is null or p_fim is null or not isfinite(p_inicio) or not isfinite(p_fim)
    or p_inicio > p_fim or p_fim - p_inicio > 730 then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  if config.s184_acesso_interno_atual('comercial') is not true then
    raise exception 'acesso_indisponivel' using errcode = '42501'; end if;
  if not coalesce((select g.habilitado from comercial.sso_painel_operacional_gate g where g.id), false) then
    raise exception 'painel_indisponivel' using errcode = '55000'; end if;
  return query select p.id, c.id, c.nome, os.id, os.numero, p.status, p.versao_atual, p.created_at, p.oportunidade_id is not null
    from comercial.proposta_origens_operacionais origem
    join comercial.propostas p on p.id = origem.proposta_id and p.deleted_at is null
    join pcm.listas_materiais l on l.id = origem.lista_materiais_id and l.ordem_servico_id = origem.ordem_servico_id
    join pcm.ordens_servico os on os.id = origem.ordem_servico_id and os.client_id = l.cliente_id and os.deleted_at is null
    join pcm.clientes c on c.id = l.cliente_id and c.deleted_at is null and c.ativo
    left join comercial.oportunidades op on op.id = p.oportunidade_id and op.cliente_id = c.id and op.deleted_at is null
    where config.sso_autorizar_acao('orcamento.operacional.ler', c.id) is true
      and p.created_at >= (p_inicio::timestamp at time zone 'America/Sao_Paulo')
      and p.created_at < ((p_fim + 1)::timestamp at time zone 'America/Sao_Paulo')
      and (p_apos is null or p.id > p_apos)
      and ((p.oportunidade_id is not null and op.id is not null)
        or (p.oportunidade_id is null and coalesce((select g.habilitado from comercial.sso_origem_operacional_gate g where g.id), false)))
    order by p.id limit 20;
end;
$$;
revoke all on function comercial.sso_painel_propostas_operacionais(date, date, uuid) from public, anon, authenticated, service_role;
