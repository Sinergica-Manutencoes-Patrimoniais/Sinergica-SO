-- ADR-1024: coincidência de data, não alteração de vencimento.
create table pcm.sso_coincidencia_calendario_feriado_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_coincidencia_calendario_feriado_gate(id,habilitado) values(true,false);
alter table pcm.sso_coincidencia_calendario_feriado_gate enable row level security;
alter table pcm.sso_coincidencia_calendario_feriado_gate force row level security;
revoke all on pcm.sso_coincidencia_calendario_feriado_gate from public,anon,authenticated,service_role;
create function pcm.sso_listar_coincidencias_calendario_feriado(p_ator_id uuid,p_cliente_id uuid,p_feriado_id uuid,p_apos uuid,p_limite integer)
returns table(ocorrencia_id uuid,plano_id uuid,rotina_id uuid,vencimento_original date,escopo text)
language plpgsql volatile security definer set search_path='' as $$
declare v_f pcm.feriados_declarados%rowtype;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode='42501'; end if;
  if p_cliente_id is null or p_feriado_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_coincidencia_calendario_feriado_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'coincidencia_feriado_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_coordenacao_feriados_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'coordenacao_feriados_desabilitada' using errcode='55000'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-feriados-cliente:'||p_cliente_id::text,0)) then raise exception 'feriados_em_alteracao' using errcode='55P03'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'feriado_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  select * into v_f from pcm.feriados_declarados f where f.id=p_feriado_id and f.cliente_id=p_cliente_id and f.ativo;
  if not found then raise exception 'feriado_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  return query select x.id,x.plano_id,x.rotina_id,x.vencimento_original,case when v_f.contrato_id is null then 'declaracao_geral' else 'verificar_contrato' end
    from pcm.ocorrencias_rotina_preparadas x join pcm.planos_manutencao p on p.id=x.plano_id and p.cliente_id=p_cliente_id
    where x.vencimento_original=v_f.data and (p_apos is null or x.id>p_apos) order by x.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_coincidencias_calendario_feriado(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
