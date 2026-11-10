-- ADR-0234: leitura privada e revogada.
create function pcm.sso_historico_parcela_os(p_parcela_id uuid,p_apos_em timestamptz,p_apos_id uuid,p_limite integer)
returns table(evento_id uuid,tipo text,os_id uuid,estado text,motivo text,ator_id uuid,ocorrido_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
  if p_parcela_id is null or p_limite is null or p_limite not between 1 and 100 or ((p_apos_em is null)<>(p_apos_id is null)) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select c.cliente_id into v_cliente from pcm.chamado_escopo_parcelas p join pcm.chamados c on c.id=p.chamado_id and c.deleted_at is null
    join pcm.sso_backlog_parcelas b on b.parcela_id=p.id and b.chamado_id=c.id and b.cliente_id=c.cliente_id where p.id=p_parcela_id;
  if not found or config.sso_autorizar_acao('chamado.escopo.gerir',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query with eventos as (
    select a.request_id evento_id,'atribuicao'::text tipo,a.os_id,null::text estado,a.payload->>'motivo' motivo,a.ator_id,a.criado_em ocorrido_em
      from pcm.sso_atribuicoes_parcela a where a.parcela_id=p_parcela_id and a.cliente_id=v_cliente
    union all
    select e.request_id,'interrupcao'::text,e.os_id,e.estado,e.motivo,e.ator_id,e.criado_em
      from pcm.sso_interrupcoes_parcela_eventos e join pcm.sso_interrupcoes_parcela i on i.parcela_id=e.parcela_id and i.os_id=e.os_id
      where e.parcela_id=p_parcela_id and i.cliente_id=v_cliente
  ) select e.evento_id,e.tipo,e.os_id,e.estado,e.motivo,e.ator_id,e.ocorrido_em from eventos e
    where p_apos_em is null or (e.ocorrido_em,e.evento_id)<(p_apos_em,p_apos_id) order by e.ocorrido_em desc,e.evento_id desc limit p_limite;
end;
$$;
revoke all on function pcm.sso_historico_parcela_os(uuid,timestamptz,uuid,integer) from public,anon,authenticated,service_role;
