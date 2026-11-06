-- ADR-0227: consulta privada, sem autorização de execução.
create function pcm.sso_os_para_interrupcao_parcela(p_parcela_id uuid,p_apos uuid,p_limite integer)
returns table(os_id uuid,numero text,estado_os text,escopo_revision bigint,suspensao_revision integer,declaracao_revision integer,declaracao_estado text)
language plpgsql stable security definer set search_path='' as $$
declare v_c pcm.chamados%rowtype;v_e pcm.chamado_escopo_composicoes%rowtype;v_s pcm.sso_suspensoes_chamado%rowtype;
begin
  if p_parcela_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select c.* into v_c from pcm.chamado_escopo_parcelas p join pcm.chamados c on c.id=p.chamado_id and c.deleted_at is null
    join pcm.sso_backlog_parcelas b on b.parcela_id=p.id and b.chamado_id=c.id and b.cliente_id=c.cliente_id where p.id=p_parcela_id and p.situacao='pendente';
  if not found or config.sso_autorizar_acao('chamado.escopo.gerir',v_c.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_e from pcm.chamado_escopo_composicoes where chamado_id=v_c.id;
  select * into v_s from pcm.sso_suspensoes_chamado where chamado_id=v_c.id and cliente_id=v_c.cliente_id;
  if v_e.chamado_id is null or v_s.chamado_id is null or v_s.estado<>'suspenso' then raise exception 'suspensao_nao_disponivel' using errcode='23514'; end if;
  return query select o.id,o.numero,o.status,v_e.revisao,v_s.revisao,coalesce(i.revisao,0),i.estado
    from pcm.ordens_servico o left join pcm.sso_interrupcoes_parcela i on i.parcela_id=p_parcela_id and i.os_id=o.id and i.cliente_id=v_c.cliente_id
    where o.chamado_id=v_c.id and o.client_id=v_c.cliente_id and o.deleted_at is null and (p_apos is null or o.id>p_apos) order by o.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_os_para_interrupcao_parcela(uuid,uuid,integer) from public,anon,authenticated,service_role;
