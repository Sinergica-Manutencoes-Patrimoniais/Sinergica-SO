-- ADR-0232: somente leitura privada e revogada.
create function pcm.sso_os_para_atribuicao_parcela(p_parcela_id uuid,p_apos uuid,p_limite integer)
returns table(os_id uuid,numero text,estado_os text,os_atualizada_em timestamptz,chamado_revision bigint,escopo_revision bigint)
language plpgsql stable security definer set search_path='' as $$
declare v_c pcm.chamados%rowtype;v_e pcm.chamado_escopo_composicoes%rowtype;
begin
  if p_parcela_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select c.* into v_c from pcm.chamado_escopo_parcelas p join pcm.chamados c on c.id=p.chamado_id and c.deleted_at is null
    join pcm.sso_backlog_parcelas b on b.parcela_id=p.id and b.chamado_id=c.id and b.cliente_id=c.cliente_id
    where p.id=p_parcela_id and p.situacao='pendente';
  if not found or config.sso_autorizar_acao('chamado.escopo.gerir',v_c.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_e from pcm.chamado_escopo_composicoes where chamado_id=v_c.id;
  if v_e.chamado_id is null then raise exception 'escopo_indisponivel' using errcode='23514'; end if;
  if exists(select 1 from pcm.sso_atribuicoes_parcela a where a.parcela_id=p_parcela_id) then return; end if;
  return query select o.id,o.numero,o.status,o.updated_at,v_c.sso_revisao,v_e.revisao from pcm.ordens_servico o
    where o.chamado_id=v_c.id and o.client_id=v_c.cliente_id and o.deleted_at is null and o.status not in ('finalizado','cancelado') and o.updated_at is not null
      and (p_apos is null or o.id>p_apos) order by o.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_os_para_atribuicao_parcela(uuid,uuid,integer) from public,anon,authenticated,service_role;
