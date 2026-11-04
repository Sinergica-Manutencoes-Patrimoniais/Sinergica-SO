-- ADR-0231: sem grant, somente snapshots públicos explicitamente revisados.
create table comercial.sso_exportacao_operacional_gate (id boolean primary key default true check (id), habilitado boolean not null default false);
alter table comercial.sso_exportacao_operacional_gate enable row level security;
alter table comercial.sso_exportacao_operacional_gate force row level security;
revoke all on comercial.sso_exportacao_operacional_gate from public, anon, authenticated, service_role;
insert into comercial.sso_exportacao_operacional_gate(id, habilitado) values (true, false);

create function comercial.sso_portal_detalhe_operacional(p_cliente_id uuid, p_os_id uuid, p_proposta_id uuid, p_versao integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_publico jsonb;
begin
  if auth.uid() is null or p_cliente_id is null or p_os_id is null or p_proposta_id is null or p_versao is null or p_versao < 1
    or not exists (select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id = uc.user_id
      where uc.user_id = auth.uid() and uc.cliente_id = p_cliente_id and u.ativo and u.papel = 'cliente-sindico') then
    raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  if not coalesce((select g.habilitado from comercial.sso_exportacao_operacional_gate g where g.id), false) then
    raise exception 'exportacao_indisponivel' using errcode = '55000'; end if;
  select comercial.projecao_proposta_publica(pub.payload_publico) into v_publico
    from comercial.propostas p join comercial.proposta_origens_operacionais origem on origem.proposta_id = p.id
    join pcm.listas_materiais l on l.id = origem.lista_materiais_id and l.cliente_id = p_cliente_id and l.ordem_servico_id = p_os_id
    join pcm.ordens_servico os on os.id = origem.ordem_servico_id and os.client_id = p_cliente_id and os.deleted_at is null
    join comercial.sso_orcamento_publicacoes pub on pub.proposta_id = p.id and pub.versao = p.versao_atual
    left join comercial.oportunidades op on op.id = p.oportunidade_id and op.cliente_id = p_cliente_id and op.deleted_at is null
    where p.id = p_proposta_id and p.deleted_at is null and p.versao_atual = p_versao
      and p.status in ('enviada', 'aceita', 'recusada')
      and ((p.oportunidade_id is not null and op.id is not null) or
        (p.oportunidade_id is null and coalesce((select g.habilitado from comercial.sso_origem_operacional_gate g where g.id), false)));
  if v_publico is null then raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  return jsonb_build_object('propostaId', p_proposta_id, 'versao', p_versao, 'ordemServicoId', p_os_id, 'payload', v_publico);
end;
$$;
revoke all on function comercial.sso_portal_detalhe_operacional(uuid, uuid, uuid, integer) from public, anon, authenticated, service_role;

-- Nenhuma origem operacional usa o payload privado para listagem pública.
create or replace function comercial.sso_portal_propostas_os(p_cliente_id uuid, p_os_id uuid, p_apos uuid default null)
returns table(id uuid, ordem_servico_id uuid, status text, versao integer, valido_ate date, payload jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_os_id is null or not exists (
    select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id = uc.user_id
    where uc.user_id = auth.uid() and uc.cliente_id = p_cliente_id and u.ativo and u.papel = 'cliente-sindico'
  ) or not exists (select 1 from pcm.ordens_servico os where os.id = p_os_id and os.client_id = p_cliente_id and os.deleted_at is null) then
    raise exception 'ordem_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  if not coalesce((select g.habilitado from comercial.sso_exportacao_operacional_gate g where g.id), false) then
    raise exception 'exportacao_indisponivel' using errcode = '55000'; end if;
  return query select p.id, origem.ordem_servico_id, p.status, p.versao_atual, p.valido_ate,
    comercial.projecao_proposta_publica(pub.payload_publico)
    from comercial.proposta_origens_operacionais origem
    join comercial.propostas p on p.id = origem.proposta_id and p.deleted_at is null
    join pcm.listas_materiais l on l.id = origem.lista_materiais_id and l.cliente_id = p_cliente_id and l.ordem_servico_id = p_os_id
    left join comercial.oportunidades o on o.id = p.oportunidade_id and o.cliente_id = p_cliente_id and o.deleted_at is null
    join comercial.proposta_versoes v on v.proposta_id = p.id and v.versao = p.versao_atual
    join comercial.sso_orcamento_publicacoes pub on pub.proposta_id = p.id and pub.versao = p.versao_atual
    where origem.ordem_servico_id = p_os_id
      and ((p.oportunidade_id is not null and o.id is not null) or
        (p.oportunidade_id is null and pub.proposta_id is not null and coalesce((select g.habilitado from comercial.sso_origem_operacional_gate g where g.id), false)))
      and p.status in ('enviada', 'aceita', 'recusada')
      and (p_apos is null or p.id > p_apos) order by p.id limit 20;
end;
$$;
revoke all on function comercial.sso_portal_propostas_os(uuid, uuid, uuid) from public, anon, authenticated, service_role;



