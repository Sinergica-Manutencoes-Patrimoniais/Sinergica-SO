-- ADR-1425: consulta aditiva restrita; não abre tabelas nem snapshots privados.
create table config.sso_custos_proposta_escopados_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into config.sso_custos_proposta_escopados_gate(id, habilitado) values(true, false);
alter table config.sso_custos_proposta_escopados_gate enable row level security;
alter table config.sso_custos_proposta_escopados_gate force row level security;
revoke all on config.sso_custos_proposta_escopados_gate from public,anon,authenticated,service_role;

create function pcm.sso_consultar_custos_proposta(p_cliente_id uuid,p_proposta_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_proposta comercial.propostas%rowtype;
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  perform 1 from config.sso_custos_proposta_escopados_gate where id and habilitado for share;
  if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  if auth.uid() is null or p_cliente_id is null or p_proposta_id is null or config.sso_autorizar_acao('custo.ler',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select p.* into v_proposta from comercial.propostas p
    join comercial.oportunidades o on o.id=p.oportunidade_id and o.deleted_at is null
    where p.id=p_proposta_id and p.deleted_at is null and o.cliente_id=p_cliente_id for share of p,o;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  if exists(select 1 from comercial.proposta_origens_operacionais origem
    left join pcm.ordens_servico os on os.id=origem.ordem_servico_id and os.deleted_at is null
    left join pcm.listas_materiais lista on lista.id=origem.lista_materiais_id
    where origem.proposta_id=p_proposta_id and (os.client_id is distinct from p_cliente_id or lista.cliente_id is distinct from p_cliente_id or lista.ordem_servico_id is distinct from os.id)) then
    raise exception 'origem_inconsistente' using errcode='23514';
  end if;
  if config.sso_autorizar_acao('custo.ler',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return jsonb_build_object('clienteId',p_cliente_id,'propostaId',v_proposta.id,'versao',v_proposta.versao_atual,
    'atualizadaEm',v_proposta.updated_at,'custoTotalCentavos',v_proposta.custo_total_centavos,
    'pisoCentavos',v_proposta.piso_centavos,'precoSugeridoCentavos',v_proposta.preco_sugerido_centavos,'precoCentavos',v_proposta.preco_centavos);
end; $$;
revoke all on function pcm.sso_consultar_custos_proposta(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_custos_proposta(uuid,uuid) to authenticated;
