-- ADR-0199: histórico paginado de decisões preliminares, sem efeitos operacionais.
create function pcm.sso_listar_decisoes_vencimento(p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_ciclo integer,p_vencimento date,
  p_apos timestamptz,p_apos_id uuid,p_limite integer)
returns table(id uuid,decisao text,motivo text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
  if not coalesce((select habilitado from pcm.plano_transicao_gate where id),false) then raise exception 'transicao_plano_bloqueada' using errcode='55000'; end if;
  if auth.uid() is null or p_plano_id is null or p_versao_id is null or p_rotina_id is null or p_ciclo is null or p_ciclo<0
    or p_vencimento is null or not isfinite(p_vencimento) or p_limite is null or p_limite not between 1 and 100
    or ((p_apos is null)<>(p_apos_id is null)) or (p_apos is not null and not isfinite(p_apos)) then raise exception 'consulta_invalida' using errcode='22023'; end if;
  select p.cliente_id into v_cliente from pcm.planos_manutencao p where p.id=p_plano_id;
  if v_cliente is null or config.sso_autorizar_acao('plano.gerir',v_cliente) is distinct from true
    or not exists(select 1 from pcm.rotinas_manutencao r where r.id=p_rotina_id and r.plano_id=p_plano_id and r.versao_id=p_versao_id) then
    raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  return query select d.id,d.decisao,d.motivo,d.ator_id,d.criado_em from pcm.plano_vencimento_decisoes d
    where d.plano_id=p_plano_id and d.versao_id=p_versao_id and d.rotina_id=p_rotina_id and d.ciclo=p_ciclo and d.vencimento=p_vencimento
      and (p_apos is null or (d.criado_em,d.id)>(p_apos,p_apos_id)) order by d.criado_em,d.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_decisoes_vencimento(uuid,uuid,uuid,integer,date,timestamptz,uuid,integer)
  from public,anon,authenticated,service_role;
