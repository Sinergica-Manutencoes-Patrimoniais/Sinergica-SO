-- ADR-1018: fotografia privada por proposta e versão.
create table comercial.sso_historico_fontes_orcamento_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into comercial.sso_historico_fontes_orcamento_gate(id,habilitado) values(true,false);
alter table comercial.sso_historico_fontes_orcamento_gate enable row level security;
alter table comercial.sso_historico_fontes_orcamento_gate force row level security;
revoke all on comercial.sso_historico_fontes_orcamento_gate from public,anon,authenticated,service_role;
create function comercial.sso_listar_fontes_orcamento(p_ator_id uuid,p_cliente_id uuid,p_proposta_id uuid,p_versao integer,p_apos integer,p_limite integer)
returns table(posicao integer,fonte jsonb) language plpgsql volatile security definer set search_path='' as $$
declare v_qtd integer; v_fontes jsonb;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode='42501'; end if;
  if p_cliente_id is null or p_proposta_id is null or p_versao is null or p_versao<1 or p_apos is null or p_apos<0 or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from comercial.sso_historico_fontes_orcamento_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'historico_fontes_desabilitado' using errcode='55000'; end if;
  if config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('custo.ler',p_cliente_id) is distinct from true or config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true then raise exception 'proposta_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  if not exists(select 1 from comercial.propostas p left join comercial.oportunidades o on o.id=p.oportunidade_id and o.deleted_at is null
    left join comercial.proposta_origens_operacionais origem on origem.proposta_id=p.id
    left join pcm.listas_materiais l on l.id=origem.lista_materiais_id
    where p.id=p_proposta_id and p.deleted_at is null and ((p.oportunidade_id is not null and o.cliente_id=p_cliente_id) or (p.oportunidade_id is null and l.cliente_id=p_cliente_id))) then raise exception 'proposta_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  select count(*) into v_qtd from comercial.sso_composicao_parcelas_comandos c where c.cliente_id=p_cliente_id and c.payload->>'propostaId'=p_proposta_id::text and c.resultado->>'revision'=p_versao::text;
  if v_qtd<>1 then raise exception 'fotografia_indisponivel_ou_ambigua' using errcode='23514'; end if;
  select c.fontes_validadas into v_fontes from comercial.sso_composicao_parcelas_comandos c where c.cliente_id=p_cliente_id and c.payload->>'propostaId'=p_proposta_id::text and c.resultado->>'revision'=p_versao::text;
  if jsonb_typeof(v_fontes)<>'array' or jsonb_array_length(v_fontes)>100 then raise exception 'fotografia_invalida' using errcode='23514'; end if;
  return query select e.ordinality::integer,e.value from jsonb_array_elements(v_fontes) with ordinality as e(value,ordinality)
    where e.ordinality>p_apos order by e.ordinality limit p_limite;
end;
$$;
revoke all on function comercial.sso_listar_fontes_orcamento(uuid,uuid,uuid,integer,integer,integer) from public,anon,authenticated,service_role;
