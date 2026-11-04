-- ADR-1023: alerta declarativo, sem alterar ocorrência ou Visita.
create table pcm.sso_impacto_feriado_visita_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_impacto_feriado_visita_gate(id,habilitado) values(true,false);
alter table pcm.sso_impacto_feriado_visita_gate enable row level security;
alter table pcm.sso_impacto_feriado_visita_gate force row level security;
revoke all on pcm.sso_impacto_feriado_visita_gate from public,anon,authenticated,service_role;
create function pcm.sso_listar_impactos_feriado_visita(p_ator_id uuid,p_cliente_id uuid,p_feriado_id uuid,p_apos uuid,p_limite integer)
returns table(ocorrencia_id uuid,plano_id uuid,rotina_id uuid,visita_id uuid,vencimento_original date)
language plpgsql volatile security definer set search_path='' as $$
declare v_f pcm.feriados_declarados%rowtype;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode='42501'; end if;
  if p_cliente_id is null or p_feriado_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_impacto_feriado_visita_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'impacto_feriado_desabilitado' using errcode='55000'; end if;
  perform 1 from pcm.sso_coordenacao_feriados_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'coordenacao_feriados_desabilitada' using errcode='55000'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-feriados-cliente:'||p_cliente_id::text,0)) then raise exception 'feriados_em_alteracao' using errcode='55P03'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'feriado_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  select * into v_f from pcm.feriados_declarados f where f.id=p_feriado_id and f.cliente_id=p_cliente_id and f.ativo;
  if not found then raise exception 'feriado_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  return query select x.id,x.plano_id,x.rotina_id,x.visita_id,x.vencimento_original
    from pcm.ocorrencias_visita_preparadas x join pcm.planos_manutencao p on p.id=x.plano_id and p.cliente_id=p_cliente_id
    join pcm.visita_origem_contratual o on o.visita_id=x.visita_id and o.cliente_id=p_cliente_id and o.serie_id=x.serie_id and o.semana_origem=x.semana_origem
    where x.vencimento_original=v_f.data and (v_f.contrato_id is null or v_f.contrato_id=o.contrato_id) and (p_apos is null or x.id>p_apos)
    order by x.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_impactos_feriado_visita(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
